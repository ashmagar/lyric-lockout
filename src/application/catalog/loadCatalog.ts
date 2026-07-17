import { buildCatalogIndex, createCatalogSnapshot } from '../../domain/catalog';
import type { CatalogIndex, CatalogSnapshot, CatalogValidationIssue } from '../../domain/catalog';
import type { Category, Song } from '../../domain/models/catalog';
import type { CatalogDocument, CatalogRepository } from '../../repositories';
import { categorySchema, songSchema } from '../../schemas';

export interface CatalogLoadResult {
  snapshot: CatalogSnapshot;
  index: CatalogIndex;
  issues: CatalogValidationIssue[];
  excludedSongSources: string[];
}

function issue(
  source: string,
  value: Omit<CatalogValidationIssue, 'source'>,
): CatalogValidationIssue {
  return { source, ...value };
}

function schemaIssues(
  source: string,
  entityType: 'CATEGORY' | 'SONG',
  issues: readonly { code: string; message: string; path: PropertyKey[] }[],
): CatalogValidationIssue[] {
  return issues.map((schemaIssue) => ({
    source,
    code: `INVALID_${entityType}`,
    severity: 'ERROR',
    kind: schemaIssue.code === 'custom' ? 'SEMANTIC' : 'STRUCTURAL',
    message: schemaIssue.message,
    path: schemaIssue.path.map(String).join('.'),
  }));
}

function loadCategories(document: CatalogDocument): {
  categories: Category[];
  issues: CatalogValidationIssue[];
} {
  if (!Array.isArray(document.value)) {
    return {
      categories: [],
      issues: [
        issue(document.source, {
          code: 'INVALID_CATEGORY_COLLECTION',
          severity: 'ERROR',
          kind: 'STRUCTURAL',
          message: 'Category JSON must contain an array',
        }),
      ],
    };
  }

  const categories: Category[] = [];
  const issues: CatalogValidationIssue[] = [];
  const categoryIds = new Set<string>();
  document.value.forEach((value, index) => {
    const parsed = categorySchema.safeParse(value);
    if (!parsed.success) {
      issues.push(
        ...schemaIssues(
          document.source,
          'CATEGORY',
          parsed.error.issues.map((schemaIssue) => ({
            ...schemaIssue,
            path: [index, ...schemaIssue.path],
          })),
        ),
      );
      return;
    }
    if (categoryIds.has(parsed.data.id)) {
      issues.push(
        issue(document.source, {
          code: 'DUPLICATE_CATEGORY_ID',
          severity: 'ERROR',
          kind: 'DUPLICATE',
          message: `Duplicate category ID "${parsed.data.id}"`,
          path: `${index}.id`,
          entityId: parsed.data.id,
        }),
      );
      return;
    }
    categoryIds.add(parsed.data.id);
    categories.push(parsed.data);
  });
  return { categories, issues };
}

function validateSongReferences(
  song: Song,
  source: string,
  categoryIds: ReadonlySet<string>,
  acceptedChallengeIds: ReadonlySet<string>,
): CatalogValidationIssue[] {
  const issues: CatalogValidationIssue[] = [];
  const localCategoryIds = new Set<string>();
  for (const categoryId of song.categoryIds) {
    if (!categoryIds.has(categoryId)) {
      issues.push(
        issue(source, {
          code: 'UNKNOWN_CATEGORY_REFERENCE',
          severity: 'ERROR',
          kind: 'REFERENTIAL',
          message: `Song references unknown category "${categoryId}"`,
          entityId: song.id,
          path: 'categoryIds',
        }),
      );
    }
    if (localCategoryIds.has(categoryId)) {
      issues.push(
        issue(source, {
          code: 'DUPLICATE_SONG_CATEGORY',
          severity: 'ERROR',
          kind: 'DUPLICATE',
          message: `Song repeats category "${categoryId}"`,
          entityId: song.id,
          path: 'categoryIds',
        }),
      );
    }
    localCategoryIds.add(categoryId);
  }

  const localChallengeIds = new Set<string>();
  for (const challenge of song.challenges) {
    if (localChallengeIds.has(challenge.id) || acceptedChallengeIds.has(challenge.id)) {
      issues.push(
        issue(source, {
          code: 'DUPLICATE_CHALLENGE_ID',
          severity: 'ERROR',
          kind: 'DUPLICATE',
          message: `Duplicate challenge ID "${challenge.id}"`,
          entityId: challenge.id,
          path: 'challenges',
        }),
      );
    }
    localChallengeIds.add(challenge.id);
  }

  if (song.enabled && song.challenges.length === 0) {
    issues.push(
      issue(source, {
        code: 'ENABLED_SONG_WITHOUT_CHALLENGES',
        severity: 'WARNING',
        kind: 'SEMANTIC',
        message: 'Enabled song has no challenges and cannot be selected',
        entityId: song.id,
        path: 'challenges',
      }),
    );
  }
  return issues;
}

export async function loadCatalog(repository: CatalogRepository): Promise<CatalogLoadResult> {
  const [categoryDocument, songDocuments] = await Promise.all([
    repository.loadCategories(),
    repository.loadSongs(),
  ]);
  const categoryResult = loadCategories(categoryDocument);
  const issues = [...categoryResult.issues];
  const excludedSongSources: string[] = [];
  const songs: Song[] = [];
  const categoryIds = new Set(categoryResult.categories.map((category) => category.id));
  const songIds = new Set<string>();
  const challengeIds = new Set<string>();

  for (const document of songDocuments) {
    const parsed = songSchema.safeParse(document.value);
    if (!parsed.success) {
      issues.push(...schemaIssues(document.source, 'SONG', parsed.error.issues));
      excludedSongSources.push(document.source);
      continue;
    }
    const song = parsed.data;
    if (songIds.has(song.id)) {
      issues.push(
        issue(document.source, {
          code: 'DUPLICATE_SONG_ID',
          severity: 'ERROR',
          kind: 'DUPLICATE',
          message: `Duplicate song ID "${song.id}"`,
          entityId: song.id,
          path: 'id',
        }),
      );
      excludedSongSources.push(document.source);
      continue;
    }

    const referenceIssues = validateSongReferences(
      song,
      document.source,
      categoryIds,
      challengeIds,
    );
    issues.push(...referenceIssues);
    if (referenceIssues.some((validationIssue) => validationIssue.severity === 'ERROR')) {
      excludedSongSources.push(document.source);
      continue;
    }

    songIds.add(song.id);
    song.challenges.forEach((challenge) => challengeIds.add(challenge.id));
    songs.push(song);
  }

  const snapshot = createCatalogSnapshot(categoryResult.categories, songs);
  return {
    snapshot,
    index: buildCatalogIndex(snapshot),
    issues,
    excludedSongSources,
  };
}
