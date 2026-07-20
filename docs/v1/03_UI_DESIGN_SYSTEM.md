# UI Design System

Last updated: July 20, 2026

## Philosophy

-   Minimalistic
-   Context-first
-   Consistent
-   Premium dark theme

## Shell Modes

### Standard Application Shell

-   Fixed-width navigation sidebar on desktop.
-   Fixed-height header and footer.
-   Flexible main content.
-   Used outside active gameplay.

### Live-Game Shell

-   Full-width gameplay workspace.
-   Fixed-height top action bar.
-   Compact bottom status rail.
-   Host control rail appears beside challenge content when needed.
-   No duplicate score or host-control surfaces.

## Branding

-   Lyric Lockout branding remains visible at the top left on every
    screen.
-   Use the shared lock icon in place of the second O in Lockout.
-   The full wordmark may collapse to the brand mark on narrow screens.
-   The brand links to Home.

## Sidebar and Status Rail

Standard pages: Navigation, resume status, and local-save context.

Live gameplay: Teams, scores, lifelines, current phase, category,
progress, and local-save state appear in the bottom status rail.

## Header

Standard pages: Screen context and room theme.

Live gameplay: Brand, level/phase context, New Game, and Finish Game.

Keep the header height stable within each shell mode.

## Footer

Standard pages: Local status/context.

Live gameplay uses the bottom status rail instead of a separate footer.

## Visual Language

-   Dark background
-   Purple/Pink/Blue accents
-   Glassmorphism
-   Rounded cards
-   Large readable typography
-   TV-friendly spacing
-   Roomy display type; avoid narrow condensed headings.
-   Preserve 16:9 media without cropping or artificial stretching.

## Reusable Components

-   Sidebar
-   Header
-   Footer
-   Team Card
-   Category Card
-   Primary Button
-   Dialogs
-   Shared brand and lock icon
-   Challenge surface and host-control rail
-   Scoreboard overlay
-   Bottom gameplay status rail

## Animations

200--350 ms.

Preferred: - Fade - Slide - Scale - Flip

Challenge: Video → Flip → Lyrics

Reveal: Fade in missing words, highlight briefly.

Scoreboard: Blur background, slide overlay, animate scores
independently.

Winner: Trophy entrance and confetti.

Always respect the reduced-motion preference.
