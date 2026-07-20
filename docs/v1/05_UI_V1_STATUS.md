# UI V1 Implementation Status

Last updated: July 20, 2026

## Completed Screens

-   Home, including resume state, compact menu cards, stacked wordmark,
    shared lock icon, crown, and neon stage background.
-   New Game choice screen.
-   Saved Game Plans search, filtering, create, edit, duplicate, delete,
    validation, and start flow.
-   Custom Categories dual-list selection with exactly ten required.
-   Backstage review for teams, lifelines, rules, and categories.
-   Category Selection with completed and unavailable categories
    disabled.
-   Challenge preview, 16:9 YouTube playback, lyric answering, host
    controls, timers, lifelines, result review, steal flow, verification,
    and scoring.
-   Scoreboard overlays with blurred context and score animations.
-   Winner screen with final standings, trophy, confetti, Play Again,
    New Game, and Home.
-   Settings for theme, motion, audio preferences, and local status.
-   Admin Portal dashboard, songs/challenges, categories, coverage,
    validation, and import/export.
-   Persistent Lyric Lockout branding on every screen.
-   Manual Finish Game and automatic completion when playable content is
    exhausted.

## Approved Product Decisions

-   Do not restore Opening Trivia. The host chooses the first team.
-   Active gameplay uses a bottom status rail instead of a left sidebar.
-   Do not restore the redundant score strip or bottom host-control
    drawer.
-   Keep host controls in the right-side challenge panel.
-   Keep New Game and Finish Game available during active gameplay.
-   Preserve YouTube media at 16:9.
-   Keep the current Admin Portal structure until a redesign is
    explicitly requested.
-   Use the shared Lockout lock icon in both the Home wordmark and
    persistent application branding.

## Remaining UI V1 Work

1.  Add a per-missing-word reveal treatment: fade in and briefly
    highlight the words that were hidden during the challenge.
2.  Update browser end-to-end journeys for the redesigned routes,
    headings, and setup flow.
3.  Run a final responsive visual-QA pass at laptop, 1080p TV, and
    narrow viewport sizes.
4.  Decide whether a dedicated Admin Database Tools section is required
    after UI V1.

## Validation Baseline

-   Type checking, linting, production build, and the unit/component test
    suite pass.
-   Browser end-to-end specifications require the update listed above
    before they can serve as the release gate.
