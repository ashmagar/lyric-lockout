# Milestone 13 — Party Check and How to Play Demo

Implement only Milestone 13 for Lyric Lockout.

## Authoritative sources

Read GDD sections 12–13, Engineering Specification section 68, the Milestone 13 guide, `prompts/00_Master_Prompt.md`, and existing media/timer/persistence services.

## Goal and scope

Implement full and Quick Party Check flows for display, theme readability, internet, YouTube, song audio, automatic pause, suspense, timer controls, verification, Local Storage, recovery, and readiness summary. Implement an instructional Demo covering category strategy, preview, pause, lifeline, Mostly Correct primary, Perfect steal, verification, split score, recap, and skip controls.

Both coordinators must use isolated temporary state and never mutate active games, scores, consumed categories, lifelines, plans, or history.

## Required tests

Test every check status, failure recovery, temporary-storage cleanup, skip behavior, both themes, and complete Demo/Party Check isolation.

Inspect and plan before editing. Run all checks and relevant E2E/manual checks, fix failures, summarize, and stop after Milestone 13.
