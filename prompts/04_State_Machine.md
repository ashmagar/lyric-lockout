# Milestone 4 — Commands, Domain Events, and State Machine

Implement only Milestone 4 for Lyric Lockout.

## Authoritative sources

Read the GDD, Engineering Specification sections 24–39, the Milestone 4 guide, `prompts/00_Master_Prompt.md`, and existing domain/engine code.

## Goal and scope

Implement the explicit GamePhase lifecycle, typed application commands with unique command IDs, command processing, structured failures, typed domain events, the legal transition table, duplicate-command protection, and recovery metadata. Domain execution returns updated state and events; it must not perform media, timer, audio, storage, or UI effects.

## Required tests

Cover every major legal transition and representative illegal transitions. Prove that Perfect blocks steals, verification cannot begin before steal resolution, scores cannot confirm twice, duplicate command IDs are safely rejected, and recovery mappings return to safe host-controlled phases. Simulate a complete lifecycle through commands.

Do not build UI or execute integration side effects.

Inspect and plan before editing. Run typecheck, lint, tests, formatting checks, and build; fix failures. Summarize and stop after Milestone 4.
