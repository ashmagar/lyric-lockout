import { type FormEvent, useState } from 'react';

import type { Category } from '../../domain';
import { categorySchema } from '../../schemas';
import styles from './AdminPage.module.css';

interface CategoryEditorProps {
  categories: readonly Category[];
  initialCategory: Category;
  isNew: boolean;
  onCancel: () => void;
  onSave: (category: Category, isNew: boolean) => Promise<boolean>;
}

function optionalTrimmed(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === '' ? undefined : trimmed;
}

export function CategoryEditor({
  categories,
  initialCategory,
  isNew,
  onCancel,
  onSave,
}: CategoryEditorProps) {
  const [draft, setDraft] = useState<Category>(() => ({ ...initialCategory }));
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const change = (next: Partial<Category>) => {
    setDraft((current) => ({ ...current, ...next }));
    setErrors([]);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const candidate = {
      ...draft,
      description: optionalTrimmed(draft.description),
      icon: optionalTrimmed(draft.icon),
      updatedAt: new Date().toISOString(),
    };
    const result = categorySchema.safeParse(candidate);
    const duplicateId = categories.some(
      (category) => category.id === candidate.id && (isNew || category.id !== initialCategory.id),
    );
    const nextErrors = result.success
      ? []
      : result.error.issues.map(
          (issue) => `${issue.path.join('.') || 'category'}: ${issue.message}`,
        );
    if (duplicateId) nextErrors.push(`id: Category ID "${candidate.id}" is already in use.`);
    if (nextErrors.length > 0 || !result.success) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    await onSave(result.data, isNew);
    setSaving(false);
  };

  return (
    <form className={styles.categoryEditor} onSubmit={(event) => void submit(event)}>
      <header className={styles.editorHeader}>
        <div>
          <p className={styles.eyebrow}>{isNew ? 'New category' : 'Edit category'}</p>
          <h2>{draft.name || 'Untitled category'}</h2>
        </div>
        <button onClick={onCancel} type="button">
          Cancel
        </button>
      </header>

      {errors.length > 0 && (
        <div className={styles.errorCard} role="alert">
          <strong>Fix these category validation errors before saving:</strong>
          <ul>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <section className={styles.editorSection}>
        <div className={styles.twoColumns}>
          <label>
            Category ID
            <input readOnly value={draft.id} />
          </label>
          <label>
            Display name
            <input onChange={(event) => change({ name: event.target.value })} value={draft.name} />
          </label>
          <label>
            Icon or emoji
            <input
              onChange={(event) => change({ icon: event.target.value })}
              value={draft.icon ?? ''}
            />
          </label>
          <label>
            Display order
            <input
              min="0"
              onChange={(event) => change({ displayOrder: Number(event.target.value) })}
              type="number"
              value={draft.displayOrder}
            />
          </label>
        </div>
        <label>
          Description
          <textarea
            onChange={(event) => change({ description: event.target.value })}
            rows={4}
            value={draft.description ?? ''}
          />
        </label>
        <label className={styles.inlineCheck}>
          <input
            checked={draft.enabled}
            onChange={(event) => change({ enabled: event.target.checked })}
            type="checkbox"
          />
          Category enabled
        </label>
      </section>

      <footer className={styles.stickySave}>
        <span>The stable ID remains unchanged when the display name is edited.</span>
        <button className={styles.primaryButton} disabled={saving} type="submit">
          {saving ? 'Saving…' : 'Save category'}
        </button>
      </footer>
    </form>
  );
}
