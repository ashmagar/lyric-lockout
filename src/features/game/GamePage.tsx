import { ButtonLink } from '../../components/ButtonLink/ButtonLink';
import { PageIntro } from '../../components/PageIntro/PageIntro';

export function GamePage() {
  return (
    <PageIntro
      description="Team setup and the complete host-led game flow arrive in later milestones."
      eyebrow="Game"
      title="The stage is getting ready."
    >
      <ButtonLink to="/playback-spike">Open playback spike</ButtonLink>
    </PageIntro>
  );
}
