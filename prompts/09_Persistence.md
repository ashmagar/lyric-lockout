# Milestone 9 — Persistence and Recovery

Implement only Milestone 9 for Lyric Lockout.

## Authoritative sources

Read the GDD reliability requirements, Engineering Specification sections 35 and 45–46, the Milestone 9 guide, `prompts/00_Master_Prompt.md`, and the completed game flow.

## Goal and scope

Implement `GameSessionRepository`, schema-versioned Local Storage envelopes, save-after-meaningful-command coordination, active challenge snapshots, startup detection, Resume/Discard UI, safe phase mappings, paused timer/media recovery, completed-game summaries, persistence errors, and corrupt-session handling. Never autoplay media, suspense, or timers after refresh.

## Required tests

Test refresh during category assignment, preview, playback, primary answering, steal answering, and score review. Test corrupt/unsupported envelopes and prove a valid active game is never silently lost.

Do not add Saved Game Plan management or Admin persistence.

Inspect and plan before editing. Run all checks and recovery integration/E2E tests, fix failures, summarize, and stop after Milestone 9.
