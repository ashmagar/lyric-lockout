# Milestone 7 — Timer and Audio Services

Implement only Milestone 7 for Lyric Lockout.

## Authoritative sources

Read the GDD timer/host-control requirements, Engineering Specification sections 21, 33, 49–51, the Milestone 7 guide, `prompts/00_Master_Prompt.md`, and the completed playback adapter.

## Goal and scope

Implement AudioService and TimerService abstractions plus browser and fake implementations. Support suspense looping, sound effects, preload, independent volumes, recoverable audio failure, wall-clock timer calculation, start/pause/resume/restart/adjust/disable/stop/dispose, one-shot expiry, cleanup, and paused restoration. Coordinate pause-video → suspense → timer → stop suspense → verification without putting rules inside services.

## Required tests

Test timer drift handling, one-shot expiration, expiry not classifying an answer, add/subtract time, paused recovery, disposal, and non-blocking audio failures.

Do not build complete gameplay UI or persistence.

Inspect and plan before editing. Run typecheck, lint, tests, formatting checks, and build; fix failures. Summarize and stop after Milestone 7.
