# Milestone 2 — Domain Models and Validation Schemas

Implement only Milestone 2 for Lyric Lockout.

## Authoritative sources

Read `docs/01_Game_Design_Document.md`, Engineering Specification sections 13–23 and 41–46 in `docs/02_Engineering_Spec_v1.md`, the Milestone 2 section of `docs/03_Codex_Implementation_Guide.md`, and `prompts/00_Master_Prompt.md`.

## Goal and scope

Implement pure TypeScript enumerations and authoritative data models for Song, Category, Challenge, TeamState, GameConfig, RoundCreationConfig, ManualChallengePool, GamePlan, GameSession, AnswerAttempt, timer state, score models, lifelines, challenge references, and HostOverride. Add independent schema-version constants and Zod schemas for persisted/catalog boundaries. Add ten sample categories, sample songs, one sample Game Plan, and one isolated demo challenge.

Encode Day Party as the default with optional Game Night; exact timers `30/45/60/90/120`; exact full points `100/200/300/400/500`; one free Hint and Team Huddle per team; and a 25-point additional-use penalty.

Do not implement progression, scoring functions, command processing, the state machine, or new UI.

## Tests and verification

Test all samples parsing, timestamp ordering, required expected lyrics, difficulty bounds, duplicate challenge IDs at the catalog-validation boundary, invalid Game Plan status, and exact defaults. Keep domain models independent of React and browser APIs.

Inspect and plan before editing. Run typecheck, lint, tests, formatting checks, and build; fix failures. Summarize and stop after Milestone 2.
