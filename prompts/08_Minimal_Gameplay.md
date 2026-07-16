# Milestone 8 — Minimal Full Gameplay

Implement only Milestone 8 for Lyric Lockout.

## Authoritative sources

Read the full GDD gameplay flow, Engineering Specification sections 60–65, the Milestone 8 guide, `prompts/00_Master_Prompt.md`, and all completed domain/application/service code.

## Goal and scope

Create a plain but complete host-led UI for Home, team setup, round building, level intro, trivia result, turn order, category assignment, challenge preview, playback, primary answering, contextual lifelines, primary review, steal offer/answering, verification, score review, turn/level summaries, and winner. Function and recoverable controls take priority over polish.

UI components must dispatch commands and render state; they must not calculate scores, mutate category history, or decide steal eligibility.

## Required tests

Add a full five-level Playwright game using fake media. Cover Perfect primary, Wrong plus Perfect steal, Mostly Correct plus Perfect steal, paid lifeline, reroll, and score override.

Do not add advanced animation, persistence, Saved Game Plans, or Admin authoring.

Inspect and plan before editing. Run all checks and relevant E2E tests, fix failures, summarize, and stop after Milestone 8.
