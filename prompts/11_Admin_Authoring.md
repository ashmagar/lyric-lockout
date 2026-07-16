# Milestone 11 — Admin Song and Challenge Authoring

Implement only Milestone 11 for Lyric Lockout.

## Authoritative sources

Read GDD section 15, Engineering Specification sections 53–57 and 63, the Milestone 11 guide, `prompts/00_Master_Prompt.md`, and existing repository/schema code.

## Goal and scope

Implement the local Admin API and Admin UI for the song library, continuous scrolling, search/filter, add/edit/duplicate/enable/disable/delete, YouTube URL parsing, challenge timestamps with capture/manual/nudge controls, real-lifecycle preview, coverage, validation, explicit save, unsaved-change protection, import/export, and backup-before-delete. Validate and perform atomic writes; keep Game Mode usable without the API.

## Required tests

Cover song creation, invalid URLs, timestamp ordering, disabled draft save, preview, continuous scrolling, filter reset, API failure retaining form state, backup behavior, and active-session snapshot isolation.

Do not add presentation polish or change gameplay rules.

Inspect and plan before editing. Run frontend/server checks and relevant E2E tests, fix failures, summarize, and stop after Milestone 11.
