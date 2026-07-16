import { ButtonLink } from '../../components/ButtonLink/ButtonLink';
import { PageIntro } from '../../components/PageIntro/PageIntro';

export function NotFoundPage() {
  return (
    <PageIntro
      description="That page is not part of tonight’s set list. Return home and take it from the top."
      eyebrow="404 — Not found"
      title="We lost the next line."
    >
      <ButtonLink to="/">Back to home</ButtonLink>
    </PageIntro>
  );
}
