import type { Category, Song } from '../../domain';
import type { CatalogValidationIssue } from '../../domain/catalog';

export interface AdminCatalogSnapshot {
  categories: Category[];
  songs: Song[];
  issues: CatalogValidationIssue[];
}

export interface AdminDeleteResult {
  backupPath: string;
}

export interface AdminCategorySaveResult {
  category: Category;
  issues: CatalogValidationIssue[];
  backupPath: string;
}

export interface AdminGateway {
  health(): Promise<void>;
  loadCatalog(): Promise<AdminCatalogSnapshot>;
  createCategory(category: Category): Promise<AdminCategorySaveResult>;
  updateCategory(category: Category): Promise<AdminCategorySaveResult>;
  saveSong(song: Song): Promise<{ song: Song; issues: CatalogValidationIssue[] }>;
  deleteSong(songId: string): Promise<AdminDeleteResult>;
  exportCatalog(songId?: string): Promise<unknown>;
  importSongs(songs: unknown, mode: 'MERGE' | 'REPLACE'): Promise<AdminCatalogSnapshot>;
}

interface ApiErrorBody {
  error?: {
    message?: string;
    issues?: CatalogValidationIssue[];
  };
}

async function responseJson(response: Response): Promise<unknown> {
  const body = (await response.json()) as unknown;
  if (!response.ok) {
    const error = body as ApiErrorBody;
    throw new AdminGatewayError(
      error.error?.message ?? `Admin API request failed (${response.status}).`,
      error.error?.issues ?? [],
    );
  }
  return body;
}

export class AdminGatewayError extends Error {
  constructor(
    message: string,
    readonly issues: CatalogValidationIssue[] = [],
  ) {
    super(message);
  }
}

export class HttpAdminGateway implements AdminGateway {
  constructor(
    private readonly baseUrl = import.meta.env.VITE_ADMIN_API_URL ?? 'http://127.0.0.1:3001',
  ) {}

  async health(): Promise<void> {
    await responseJson(await fetch(`${this.baseUrl}/api/health`));
  }

  async loadCatalog(): Promise<AdminCatalogSnapshot> {
    const [categoryBody, songBody] = await Promise.all([
      responseJson(await fetch(`${this.baseUrl}/api/categories`)),
      responseJson(await fetch(`${this.baseUrl}/api/songs`)),
    ]);
    const categoryResult = categoryBody as {
      categories: Category[];
      issues: CatalogValidationIssue[];
    };
    const songResult = songBody as {
      songs: Song[];
      issues: CatalogValidationIssue[];
    };
    const issues = [...categoryResult.issues, ...songResult.issues].filter(
      (issue, index, all) =>
        all.findIndex(
          (candidate) =>
            candidate.code === issue.code &&
            candidate.source === issue.source &&
            candidate.path === issue.path,
        ) === index,
    );
    return {
      categories: categoryResult.categories,
      songs: songResult.songs,
      issues,
    };
  }

  async createCategory(category: Category): Promise<AdminCategorySaveResult> {
    return (await responseJson(
      await fetch(`${this.baseUrl}/api/categories`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(category),
      }),
    )) as AdminCategorySaveResult;
  }

  async updateCategory(category: Category): Promise<AdminCategorySaveResult> {
    return (await responseJson(
      await fetch(`${this.baseUrl}/api/categories/${encodeURIComponent(category.id)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(category),
      }),
    )) as AdminCategorySaveResult;
  }

  async saveSong(song: Song) {
    return (await responseJson(
      await fetch(`${this.baseUrl}/api/songs`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(song),
      }),
    )) as { song: Song; issues: CatalogValidationIssue[] };
  }

  async deleteSong(songId: string): Promise<AdminDeleteResult> {
    return (await responseJson(
      await fetch(`${this.baseUrl}/api/songs/${encodeURIComponent(songId)}`, {
        method: 'DELETE',
      }),
    )) as AdminDeleteResult;
  }

  async exportCatalog(songId?: string): Promise<unknown> {
    const query = songId ? `?songId=${encodeURIComponent(songId)}` : '';
    return responseJson(await fetch(`${this.baseUrl}/api/export${query}`));
  }

  async importSongs(songs: unknown, mode: 'MERGE' | 'REPLACE'): Promise<AdminCatalogSnapshot> {
    return (await responseJson(
      await fetch(`${this.baseUrl}/api/import`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ songs, mode }),
      }),
    )) as AdminCatalogSnapshot;
  }
}
