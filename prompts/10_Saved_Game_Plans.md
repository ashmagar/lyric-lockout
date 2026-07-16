# Milestone 10 — Saved Game Plans

Implement only Milestone 10 for Lyric Lockout.

## Authoritative sources

Read GDD section 11, Engineering Specification section 67, the Milestone 10 guide, `prompts/00_Master_Prompt.md`, and existing repositories/round builder.

## Goal and scope

Implement GamePlan repository operations and UI for list, create, edit, duplicate, rename, delete, validate, and play. Support ten categories, random/manual category modes, full catalog/curated pools, game configuration, preferred theme, reveal-song setting, validation status, and immutable copying into a new independent GameSession.

## Required tests

Prove a plan can start multiple independent games; editing a plan cannot mutate an active session; invalid plans cannot start; warning plans require acceptance; duplicates receive new IDs; and curated pools survive save/load/copy.

Do not add Admin song authoring or presentation polish.

Inspect and plan before editing. Run all checks and relevant integration/E2E tests, fix failures, summarize, and stop after Milestone 10.
