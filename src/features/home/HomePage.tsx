import { ButtonLink } from '../../components/ButtonLink/ButtonLink';
import { PageIntro } from '../../components/PageIntro/PageIntro';

export function HomePage() {
  return (
    <PageIntro
      description="Two teams. Ten categories. One chance to remember what comes next when the music stops."
      eyebrow="The party starts here"
      title="Ready to lock in the lyrics?"
    >
      <ButtonLink to="/game">Open game setup</ButtonLink>
      <ButtonLink to="/admin" variant="secondary">
        Explore admin
      </ButtonLink>
    </PageIntro>
  );
}
