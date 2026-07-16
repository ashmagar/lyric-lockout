# Lyric Lockout
## Codex Implementation Guide and Milestone Prompts

Use this guide with:

- `docs/01_Game_Design_Document.md`
- `docs/02_Engineering_Spec.md`
- `prompts/00_Master_Prompt.md`

Each milestone should be implemented in a separate Codex session where practical.

---

# Milestone 1 — Project Foundation

## Goal

Create a clean, runnable React + TypeScript project with the required development tooling and repository structure.

## Scope

Implement:

- Vite React TypeScript app;
- React Router;
- Zustand;
- Zod;
- Vitest;
- React Testing Library;
- Playwright setup;
- ESLint;
- Prettier;
- TypeScript strict mode;
- initial folder structure;
- placeholder Home, Game, Admin, Settings routes;
- basic Day Party theme shell;
- README setup instructions.

## Do Not Implement

- gameplay rules;
- YouTube integration;
- scoring;
- Admin CRUD;
- Saved Game Plans.

## Tests

- application renders;
- routes load;
- unknown route handled;
- theme bootstrap defaults to Day Party.

## Verification

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## Acceptance Criteria

- app starts;
- routes render;
- tooling passes;
- folder boundaries are documented;
- README is current.

---

# Milestone 2 — Domain Models and Validation Schemas

## Goal

Implement the authoritative domain types and Zod schemas without gameplay behavior.

## Scope

Implement enums, Song, Category, Challenge, TeamState, GameConfig, RoundCreationConfig, ManualChallengePool, GamePlan, GameSession, AnswerAttempt, Timer state, Score models, HostOverride, schema versions, sample categories, sample songs, one sample Game Plan, and one demo challenge.

## Required Rules

- Day Party default;
- Game Night optional;
- exact difficulty timers;
- exact point values;
- free lifeline counts;
- 25-point additional-use penalty.

## Tests

- valid samples parse;
- invalid timestamps fail;
- missing expected lyrics fail;
- invalid difficulty fails;
- duplicate challenge IDs detected at catalog-validation layer;
- invalid Game Plan status detected.

## Do Not Implement

- game progression;
- scoring functions;
- state machine;
- UI beyond optional data inspection.

## Acceptance Criteria

- all sample data validates;
- schemas align with Engineering Specification;
- no UI dependency in domain models.

---

# Milestone 3 — Pure Game Engine

## Goal

Implement deterministic gameplay rules independent of React and browser APIs.

## Scope

Implement game creation, exactly two teams, Level 1–5 progression, two primary turns per level, category consumption across the entire game, trivia winner recording, first-playing team selection, category assignment modes, primary result classification, steal eligibility, scoring matrix, free and paid lifelines, host score override, turn completion, level completion, game completion, score idempotency, and injectable randomness.

## Required Tests

### Category

- consumed categories never reset;
- completed game uses ten categories;
- steal does not consume category;
- duplicate category selection rejected.

### Scoring

Test every matrix branch at all five levels.

### Lifelines

- first Hint free;
- second and later Hint cost 25;
- first Ask a Friend free;
- second and later Ask a Friend cost 25;
- counters separate;
- uses persist across levels.

### Progression

- two turns required per level;
- steal does not count as primary turn;
- Level 5 completes game.

### Overrides

- recommended score preserved;
- final score independently overridden;
- score applies once.

## Acceptance Criteria

A full five-level game can be simulated in unit tests.

---

# Milestone 4 — Commands, Domain Events, and State Machine

## Goal

Implement explicit phases and controlled transitions.

## Scope

Implement GamePhase, command types, command processor, structured failures, domain events, legal transition table, duplicate command protection, and recovery metadata.

## Required Tests

- every major legal transition;
- representative illegal transitions;
- steal cannot start after Perfect;
- verification cannot begin before steal resolution;
- score cannot confirm twice;
- duplicate command IDs rejected safely;
- recovery mappings.

## Acceptance Criteria

A complete game lifecycle can be simulated using commands and phases.

---

# Milestone 5 — Catalog Repository, Indexing, Coverage, and Round Builder

## Goal

Load JSON content, validate it, index it, and select eligible challenges.

## Scope

Implement repository interfaces, in-memory repository, JSON/static repository, catalog snapshot, challenge indexes by category and level, coverage matrix, partial catalog loading, validation issues, round validation, all four round-building combinations, curated challenge pools, challenge selection exclusions, deterministic randomness, reroll exclusion, and song-reuse fallback without challenge reuse.

## Tests

- invalid song excluded but valid catalog loads;
- unknown category reference detected;
- duplicate IDs detected;
- curated pool restricts candidates;
- rejected challenge does not reappear;
- played challenge never reused;
- song reuse fallback flagged;
- coverage counts correct.

## Acceptance Criteria

Given category and level, the system returns a valid eligible challenge or structured diagnostics.

---

# Milestone 6 — YouTube Playback Technical Spike

## Goal

Prove the highest-risk external integration before building full gameplay UI.

## Scope

Build one technical-spike screen that initializes the YouTube IFrame player, loads one configured video ID, seeks to playback start, starts after host interaction, polls current time, pauses at challenge timestamp, records actual pause time, seeks to verification start, optionally stops at verification end, reports playback errors, and supports Retry and Restart.

## Architecture

Implement a generic `VideoPlayerService`. YouTube-specific details must remain inside the adapter.

## Tests

Automated tests should use a fake player. Manual smoke test should use a real embeddable YouTube video.

## Acceptance Criteria

```text
load → play → automatic pause → verify replay
```

Do not build the full game UI in this milestone.

---

# Milestone 7 — Timer and Audio Services

## Goal

Add suspense, effects, and host-controlled timers.

## Scope

Implement AudioService, suspense loop, sound effects abstraction, preload, volume settings, TimerService, wall-clock timer calculation, pause, resume, restart, adjust, disable, expiration event, cleanup, and fake services for tests.

## Required Tests

- timer drift handling;
- expiration fires once;
- expiry does not classify Wrong;
- add/subtract time;
- restore paused;
- audio failure does not block gameplay.

## Acceptance Criteria

```text
pause video → start suspense → run timer → stop suspense → verify
```

---

# Milestone 8 — Minimal Full Gameplay

## Goal

Create a plain but complete playable game using existing domain and media services.

## Scope

Implement minimal Home, Team Setup, Round Builder, Level Intro, Trivia Result, Turn Order, Category Assignment, Challenge Preview, Playback, Primary Answering, Lifelines, Primary Result Review, Steal Offer, Steal Answering, Verification, Final Score Review, Turn Summary, Level Summary, and Winner.

## UI Priority

Function over polish. No advanced animation required.

## Required Tests

- one complete five-level Playwright game using fake media;
- Perfect primary path;
- Wrong + Perfect steal;
- Mostly Correct + Perfect steal;
- paid lifeline;
- reroll;
- score override.

## Acceptance Criteria

A complete game can be played end to end.

---

# Milestone 9 — Persistence and Recovery

## Goal

Prevent browser refresh from destroying the game.

## Scope

Implement GameSessionRepository, Local Storage envelope, schema version, save after meaningful commands, active challenge snapshot, Resume/Discard screen, safe recovery mappings, timer restore paused, media restore paused, completed-game summary, and corrupt-session handling.

## Tests

Refresh during category assignment, preview, video playback, primary answering, steal answering, and score review.

## Acceptance Criteria

A browser refresh never silently loses a valid active game.

---

# Milestone 10 — Saved Game Plans

## Goal

Allow the host to prepare multiple reusable games before a party.

## Scope

Implement GamePlan repository, list, create, edit, duplicate, rename, delete, validation, theme preference, reveal-song setting, manual/random categories, full catalog/curated pools, plan status, start game from plan, and independent GameSession copy.

## Tests

- plan reused multiple times;
- editing plan does not mutate active game;
- invalid plan cannot start;
- warning-accepted plan can start;
- duplicate gets new ID;
- curated pools preserved.

## Acceptance Criteria

Host can prepare and save at least three different party setups.

---

# Milestone 11 — Admin Song and Challenge Authoring

## Goal

Allow catalog maintenance without manual JSON editing.

## Scope

Implement local Admin API, Song Library, continuous scrolling, search and filters, add/edit/duplicate/disable/delete song, YouTube URL parsing, Challenge Editor, timestamp capture, nudge controls, preview, coverage dashboard, catalog validation, explicit save, unsaved-change warning, export, and backup-before-delete.

## Tests

- add song;
- invalid URL;
- timestamp ordering;
- save disabled draft;
- preview;
- continuous scrolling;
- filtering resets scroll;
- API failure preserves form state;
- active game snapshot unaffected.

## Acceptance Criteria

A new playable song can be created without touching JSON manually.

---

# Milestone 12 — Themes and UI System

## Goal

Implement the shared visual system.

## Scope

Implement semantic design tokens, Day Party default, Game Night, theme switch, Local Storage persistence, Saved Game Plan theme preference, shared gameplay shell, score strip, collapsible Host Drawer, contextual lifelines, no duplicate Level/Difficulty, no remaining-category count in active challenge area, responsive 16:9 behavior, and reduced-motion support.

## Tests

- default theme;
- switch persistence;
- same layout in both themes;
- blind challenge hides song;
- lifelines contextual;
- host panel hides expected lyrics.

## Acceptance Criteria

Both themes work without separate component implementations.

---

# Milestone 13 — Party Check and How to Play Demo

## Goal

Allow technical rehearsal and player instruction before the real game.

## Scope

### Party Check

- display;
- theme readability;
- YouTube load;
- song audio;
- automatic pause;
- suspense;
- timer controls;
- verification;
- Local Storage;
- readiness summary;
- Quick Check.

### Demo

- intro;
- category explanation;
- preview;
- playback;
- pause;
- lifeline;
- Mostly Correct primary;
- Perfect steal;
- verification;
- split score;
- recap.

## Isolation Requirement

Neither flow may modify active game, scores, categories, lifelines, Game Plans, or completed-game history.

## Tests

- every check status;
- failure recovery;
- temporary persistence cleanup;
- Demo isolation;
- theme support;
- skip behavior.

## Acceptance Criteria

Host can test the setup and explain the game without creating a real game.

---

# Milestone 14 — Presentation Polish

## Goal

Make gameplay feel like a continuous game show.

## Scope

Implement guided transitions, level intro, turn announcement, category emphasis, challenge selection animation, score count-up, level-complete fanfare, winner celebration, contextual sound effects, skip transitions, keyboard shortcuts, and polished loading/recovery presentation.

## Constraints

- no new gameplay rules;
- no animation may block required host controls;
- reduced-motion preference must work.

## Acceptance Criteria

Gameplay feels continuous and clear without sacrificing reliability.

---

# Milestone 15 — Release Candidate

## Goal

Prepare a party-ready build.

## Scope

- fix critical defects;
- run full automated suite;
- Chrome full test;
- Edge/Safari smoke tests;
- 1920×1080 and 1366×768 checks;
- full Party Check;
- full Demo;
- complete five-level rehearsal;
- backup/export;
- startup documentation;
- release notes;
- retain previous build.

## Mandatory Manual Rehearsal

During one game:

- use both free lifelines;
- use one paid lifeline;
- complete one Perfect steal;
- reroll one song;
- override one score;
- pause/resume timer;
- refresh/recover;
- switch theme;
- start second game from same plan.

## Acceptance Criteria

No critical failure requires restarting the application.

---

# Standard Codex Milestone Prompt Template

```text
You are implementing Milestone <N>: <NAME> for Lyric Lockout.

Authoritative files:
- docs/01_Game_Design_Document.md
- docs/02_Engineering_Spec.md
- prompts/00_Master_Prompt.md
- prompts/<CURRENT_MILESTONE>.md

Before changing code:
1. Inspect the repository.
2. Read the relevant specification sections.
3. Report repository assessment.
4. Provide a concise implementation plan.
5. List files expected to change.
6. List tests to add.
7. List verification commands.

Implementation constraints:
- Implement only this milestone.
- Do not invent gameplay rules.
- Keep business logic out of React components.
- Use existing abstractions where present.
- Do not continue to the next milestone.
- Add tests for all new rule behavior.
- Run typecheck, lint, tests, and build.
- Fix failures before stopping.

At completion, provide:
- summary;
- files changed;
- tests run;
- verification results;
- known limitations;
- suggested next milestone.
```

---

# Suggested Repository Prompt Layout

```text
prompts/
├── 00_Master_Prompt.md
├── 01_Foundation.md
├── 02_Domain_Models.md
├── 03_Game_Engine.md
├── 04_State_Machine.md
├── 05_Catalog_and_Round_Builder.md
├── 06_YouTube_Spike.md
├── 07_Timer_and_Audio.md
├── 08_Minimal_Gameplay.md
├── 09_Persistence.md
├── 10_Saved_Game_Plans.md
├── 11_Admin_Authoring.md
├── 12_Themes_and_UI.md
├── 13_Party_Check_and_Demo.md
├── 14_Presentation_Polish.md
└── 15_Release_Candidate.md
```

---

# Recommended First Codex Session

```text
Implement Milestone 1 — Project Foundation.

Read:
- docs/01_Game_Design_Document.md
- docs/02_Engineering_Spec.md
- prompts/00_Master_Prompt.md

Create a React + TypeScript + Vite project with the required tooling, routing, folder structure, Day Party theme bootstrap, placeholder routes, and README.

Do not implement gameplay rules.

Before editing, inspect the repository and provide:
- repository assessment;
- implementation plan;
- expected files;
- tests;
- verification commands.

After implementation:
- run typecheck;
- run lint;
- run tests;
- run build;
- fix failures;
- summarize and stop.
```

---

# Final Handoff Rule

Do not ask Codex to build all milestones in one session.

Use one milestone at a time.

Review after each milestone and commit stable work before starting the next milestone.

The first critical checkpoint is Milestone 6: YouTube Playback Technical Spike.

The first playable checkpoint is Milestone 8: Minimal Full Gameplay.
