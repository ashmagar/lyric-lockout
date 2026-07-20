# Lyric Lockout — UI V1 Master Prompt

Last updated: July 20, 2026

## Read these documents in order before implementing any UI:

1.  **02_APPLICATION_UX_SPEC.md**
    -   Defines every screen and approved UI V1 product decisions.
2.  **03_UI_DESIGN_SYSTEM.md**
    -   Defines layout, shell, animations, reusable components, and
        visual language.
3.  **04_REFERENCE_SCREENSHOTS.md**
    -   Defines how the original mockups should be interpreted.
4.  **05_UI_V1_STATUS.md**
    -   Records completed work, approved deviations, and remaining tasks.

## General Rules

-   Consistency over creativity.
-   Reuse components whenever possible.
-   Never reverse an approved product decision without explicit instruction.
-   Keep the standard application shell consistent across non-gameplay pages.
-   Use the approved live-game shell during active gameplay.
-   Avoid duplicate information.
-   Prefer context-first, minimal interfaces.
-   Prioritize large, readable typography and TV-friendly spacing.
-   Preserve gameplay behavior while improving presentation.
-   Optimize from real gameplay feedback after UI V1 is stable.

## Source-of-Truth Priority

When documents, screenshots, and later feedback disagree, use this order:

1.  The latest explicit user-approved decision.
2.  `05_UI_V1_STATUS.md`.
3.  `02_APPLICATION_UX_SPEC.md`.
4.  `03_UI_DESIGN_SYSTEM.md`.
5.  Reference screenshots.

Reference screenshots are visual direction, not a reason to restore an
interaction or layout that was intentionally changed later.

## Implementation Workflow

1.  Read the relevant screen specification.
2.  Check the implementation-status and approved-decision notes.
3.  Use the reference screenshot for visual direction.
4.  Reuse existing components and visual patterns.
5.  Preserve the appropriate standard or live-game shell.
6.  Validate readability, responsive behavior, and gameplay continuity.

If uncertain, choose consistency over inventing a new pattern.
