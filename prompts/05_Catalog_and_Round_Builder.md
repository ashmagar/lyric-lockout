# Milestone 5 — Catalog, Indexing, Coverage, and Round Builder

Implement only Milestone 5 for Lyric Lockout.

## Authoritative sources

Read the GDD, Engineering Specification sections 23 and 40–44, the Milestone 5 guide, `prompts/00_Master_Prompt.md`, and existing contracts/engine code.

## Goal and scope

Implement repository interfaces, in-memory and JSON/static repositories, partial catalog loading, structural/referential/semantic validation issues, catalog snapshots, song/category/challenge indexes, category-by-level coverage, round validation, all four random/manual category and full-catalog/curated-pool combinations, curated challenge pools, eligible selection exclusions, deterministic randomness, reroll exclusion, and song-reuse fallback without challenge reuse.

## Required tests

Prove invalid songs are excluded while valid content loads; unknown category references and duplicate IDs are reported; curated pools constrain candidates; rejected and played challenges never return; song reuse fallback is flagged; and coverage counts are exact. Selection must return either a valid challenge or structured diagnostics.

Do not build playback, Admin CRUD, or gameplay UI.

Inspect and plan before editing. Run typecheck, lint, tests, formatting checks, and build; fix failures. Summarize and stop after Milestone 5.
