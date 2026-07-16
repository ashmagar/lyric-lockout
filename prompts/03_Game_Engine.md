# Milestone 3 — Pure Game Engine

Implement only Milestone 3 for Lyric Lockout.

## Authoritative sources

Read the GDD, Engineering Specification gameplay/model sections, the Milestone 3 guide, `prompts/00_Master_Prompt.md`, and the completed Milestone 2 contracts.

## Goal and scope

Implement deterministic, browser-independent game creation and rules: exactly two teams, Levels 1–5, two primary turns per level, permanent ten-category consumption, trivia-winner and first-team recording, category assignment modes, primary classification, steal eligibility, the complete scoring matrix, free and paid lifelines, host score override, turn/level/game completion, score idempotency, and injectable randomness.

Do not add React behavior, commands/events, a phase state machine, media, persistence, or catalog selection.

## Required tests

Test permanent category consumption and duplicate rejection; every scoring branch at all five levels; separate free/paid lifeline counters and persistence across levels; two primary turns per level; steals not counting as primary turns; Level 5 completion; preserved recommended scores; independent overrides; and apply-once scoring. Simulate a full game in unit tests.

Inspect and plan before editing. Run typecheck, lint, tests, formatting checks, and build; fix failures. Summarize and stop after Milestone 3.
