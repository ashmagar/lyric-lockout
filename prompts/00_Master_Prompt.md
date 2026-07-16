# Lyric Lockout
## Codex Master Prompt

You are implementing **Lyric Lockout**, a local-first party game that tests lyric memory rather than singing ability.

Treat the following files as authoritative:

1. `docs/01_Game_Design_Document.md`
2. `docs/02_Engineering_Spec.md`
3. The current milestone prompt under `prompts/`

If these sources conflict, use this priority:

1. Game Design Document
2. Engineering Specification
3. Current milestone prompt
4. Existing code

Earlier chats, discarded drafts, old HLD amendments, and prototype notes are non-authoritative.

---

# Project Intent

This is a fun private party project, not a commercial platform.

The MVP should be:

- reliable enough for a complete party game;
- simple to run on a laptop connected to a TV;
- easy to maintain;
- local-first;
- testable;
- implemented incrementally.

Do not over-engineer.

---

# Mandatory Product Rules

Do not change or reinterpret these rules.

- Exactly two teams play.
- One game has five levels.
- One game has ten categories.
- Categories are consumed permanently for the round.
- Categories do not reset between levels.
- Each team gets one primary challenge per level.
- The host manually records the trivia winner and first-playing team.
- Category assignment may be self-selected, opponent-assigned, or host-assigned.
- YouTube playback begins at a configured timestamp.
- The video pauses at a configured challenge timestamp.
- Suspense audio begins after the pause.
- Primary timers are 30, 45, 60, 90, and 120 seconds for Levels 1–5.
- The host can pause, resume, restart, extend, shorten, disable, or end the timer.
- Timer expiry does not automatically mark an answer Wrong.
- Each team gets one free Hint and one free Ask a Friend per game.
- Additional uses remain unlimited and cost 25 points each.
- Perfect primary answer: no steal.
- Mostly Correct or Wrong primary answer: opposing team gets one steal opportunity.
- Only a Perfect steal earns points.
- Perfect primary: primary team gets full points.
- Mostly Correct primary + Perfect steal: both teams get half points.
- Mostly Correct primary + failed steal: primary gets half, stealing team gets zero.
- Wrong primary + Perfect steal: primary gets zero, stealing team gets half.
- Wrong primary + failed steal: both get zero.
- Host may override either team’s final score.
- Score must never be applied twice.
- Reroll preserves team, category, level, and turn.
- Expected lyrics must stay hidden until steal resolution.
- The default theme is Day Party.
- Game Night is selectable.
- Large lists use continuous scrolling, not pagination.
- Manual song selection means curated/approved challenge pools, not exact scripting.
- Multiple Saved Game Plans may be created in advance.
- Party Check and How to Play Demo must not affect real game state.

---

# Architecture Rules

Follow the Engineering Specification.

Mandatory boundaries:

- Game rules belong in the Domain Layer.
- React components must not calculate scores, mutate category history, or decide steal eligibility.
- YouTube integration must be behind an adapter.
- Timer, audio, persistence, and repositories must be separate services.
- Use an explicit game phase/state machine.
- Use commands and domain events.
- Use stable IDs.
- Use schema versions for persisted data.
- Use repository interfaces so JSON can be replaced later.
- Persist after meaningful state changes.
- Recover media and timers in a paused state after refresh.
- Keep both recommended and overridden scores.
- Keep the active game independent from later catalog edits.

---

# Technology Baseline

Use:

- React
- TypeScript
- Vite
- React Router
- Zustand
- Zod
- Vitest
- React Testing Library
- Playwright
- ESLint
- Prettier

Use TypeScript strict mode where practical.

---

# Working Style

For every milestone:

1. Inspect the repository first.
2. Read the relevant specification sections.
3. Summarize your understanding.
4. Propose a concise implementation plan.
5. Implement only the requested milestone.
6. Add or update tests.
7. Run type check, lint, tests, relevant integration tests, and build.
8. Fix failures before stopping.
9. Update README or docs when setup or architecture changes.
10. Summarize files changed, key decisions, tests run, known limitations, and recommended next milestone.
11. Stop after the current milestone.

Do not continue into the next milestone automatically.

---

# Change Discipline

Do not invent new gameplay features.

When a requirement is unclear:

- use the smallest interpretation consistent with the documents;
- preserve host flexibility;
- avoid irreversible decisions;
- document the assumption.

If a specification appears technically impossible:

1. stop implementation of the affected part;
2. explain the exact technical constraint;
3. propose the smallest compatible change;
4. identify affected requirements;
5. wait for approval before changing the authoritative documents.

---

# Coding Standards

- Prefer small pure functions.
- Prefer explicit domain types.
- Avoid `any`.
- Avoid circular dependencies.
- Avoid business logic inside UI event handlers.
- Add comments only for rationale or unusual constraints.
- Handle errors explicitly.
- Keep side effects out of reducers and scoring functions.
- Use deterministic randomness through an injectable random provider.
- Ensure commands are idempotent where duplicate UI events are possible.
- Do not leave placeholder TODO logic in completed milestone scope.

---

# Testing Standards

The Domain Layer should have the largest test coverage.

At minimum, tests must cover:

- all scoring branches;
- all steal branches;
- free and paid lifelines;
- category consumption;
- level progression;
- duplicate command protection;
- score idempotency;
- timer expiry behavior;
- reroll exclusion;
- Saved Game Plan copying;
- refresh recovery;
- Party Check isolation;
- Demo isolation.

Use fake adapters for YouTube, audio, and timers in normal automated tests.

Do not make standard CI depend on live YouTube availability.

---

# Definition of Done

A milestone is complete only when:

- requested behavior exists;
- tests exist;
- tests pass;
- type checking passes;
- lint passes;
- build succeeds;
- no new critical warning exists;
- relevant docs are updated;
- work can be demonstrated;
- milestone scope contains no placeholder logic.

---

# First Response Format

Before changing code, respond with:

## Repository Assessment

- current structure;
- relevant existing files;
- missing prerequisites;
- conflicts or risks.

## Milestone Plan

- ordered steps;
- files expected to change;
- tests to add;
- verification commands.

Then begin implementation.
