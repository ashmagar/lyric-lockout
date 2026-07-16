# Milestone 6 — YouTube Playback Technical Spike

Implement only Milestone 6 for Lyric Lockout.

## Authoritative sources

Read the GDD playback requirements, Engineering Specification sections 47–49, the Milestone 6 guide, `prompts/00_Master_Prompt.md`, and existing service boundaries.

## Goal and scope

Build one technical-spike route that initializes the YouTube IFrame player, loads one configured video ID, seeks to playback start, starts only after host interaction, polls current time, pauses at the challenge timestamp, records actual pause time, seeks to verification start, optionally stops at verification end, reports playback errors, and supports Retry and Restart.

Keep YouTube details behind a generic `VideoPlayerService` adapter. Do not build the full gameplay UI.

## Tests and verification

Use a fake player for automated load/play/pause/seek/error tests. Add a documented manual smoke test using an embeddable YouTube video. Demonstrate `load → play → automatic pause → verification replay`.

Inspect and plan before editing. Run typecheck, lint, tests, relevant integration tests, formatting checks, and build; fix failures. Summarize manual limitations and stop after Milestone 6.
