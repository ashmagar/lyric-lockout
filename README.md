# Lyric Lockout

Lyric Lockout is a local-first, host-led party game about remembering the next lyric when the music stops. The repository now contains a complete plain host-led gameplay UI, validated domain and catalog services, real and fake YouTube playback paths, and browser-ready timer and audio services.

## Prerequisites

- Node.js 24 LTS (declared in `.nvmrc`)
- npm (included with Node.js)

The app targets current desktop Chrome first, with Edge, Safari, and Firefox as secondary targets.

## Setup

With [NVM](https://github.com/nvm-sh/nvm) installed:

```bash
nvm install
nvm use
npm install
```

NVM keeps the project Node version separate from Conda environments and other projects. If NVM is not used, install a compatible Node.js 24 release directly and start with `npm install`.

For the complete local authoring experience, use two terminals:

```bash
# Terminal 1: local Admin API
npm run admin

# Terminal 2: browser application
npm run dev
```

Vite prints the browser URL, normally `http://localhost:5173`. The Admin API listens only on
`http://127.0.0.1:3001`. Game Mode remains usable if that API is not running.

## Quality checks

```bash
npm run typecheck
npm run admin:check
npm run lint
npm run test
npm run build
```

Playwright is configured for browser smoke tests. Install its Chromium binary once before the first E2E run:

```bash
npx playwright install chromium
npm run e2e
```

Other useful commands:

```bash
npm run test:watch
npm run format:check
npm run preview
```

## Routes

| Route             | Purpose                                                |
| ----------------- | ------------------------------------------------------ |
| `/`               | Home and application entry point                       |
| `/game`           | Complete two-team, five-level host-led game            |
| `/plans`          | Create, validate, reuse, and manage Saved Game Plans   |
| `/playback-spike` | Isolated YouTube playback and pause-point rehearsal    |
| `/admin`          | Local song, challenge, coverage, and catalog authoring |
| `/settings`       | Placeholder for display, audio, and theme settings     |
| any unknown route | Friendly not-found screen                              |

## Source boundaries

The dependency direction is `UI → application → domain`. Integration services and repositories are accessed through application-layer coordination; the domain must remain independent of React and browser APIs.

| Folder             | Responsibility                                              |
| ------------------ | ----------------------------------------------------------- |
| `src/app`          | Routing and application composition                         |
| `src/components`   | Reusable presentation components with no game rules         |
| `src/features`     | Route-level feature UI, grouped by user-facing capability   |
| `src/store`        | Zustand UI/application state coordination; never game rules |
| `src/application`  | Commands, use cases, and side-effect coordination           |
| `src/domain`       | Pure TypeScript rules and authoritative game behavior       |
| `src/services`     | Media, timer, audio, persistence, and other integrations    |
| `src/repositories` | Data-access interfaces and implementations                  |
| `src/schemas`      | Zod validation schemas and persisted-data boundaries        |
| `src/utils`        | Small general-purpose helpers without domain policy         |
| `src/tests`        | Shared test setup and cross-feature tests                   |
| `e2e`              | Playwright browser tests                                    |
| `data`             | Version-controlled catalog, plan, demo, and backup data     |
| `public`           | Static audio and image assets served by Vite                |
| `server`           | Local-only Admin API and atomic catalog file persistence    |

Empty boundary folders are intentional placeholders for later milestones and contain no behavior yet.

## Data contracts and samples

Pure TypeScript models live in `src/domain`; Zod validation boundaries live independently in `src/schemas`. Domain code has no React, Zustand, DOM, storage, or media dependency.

Milestone 2 sample data includes:

- exactly ten categories in `data/categories.json`;
- two fictional one-file-per-song records in `data/songs`;
- one ten-category draft Game Plan in `data/game-plans`;
- one isolated challenge in `data/demo`.

The sample YouTube IDs are deliberate placeholders. They validate the catalog shape but are not intended for playback; a real embeddable video is introduced by the Milestone 6 technical spike.

The Engineering Specification names Game Plan validation status without enumerating its values. Milestone 2 uses `DRAFT`, `READY`, `READY_WITH_WARNINGS`, and `INVALID`, which are the smallest states needed by the documented save/validate/play workflow. Supporting Game Session snapshot types remain data-only; the engine operates on them without media or persistence dependencies.

## Pure game engine

Milestone 3 lives in `src/domain/engine`. Its immutable functions create games, record trivia and team order, consume categories, classify attempts, account for lifelines, calculate and override scores, and progress two primary turns through all five levels. Callers provide IDs, timestamps, challenge references, and randomness, so engine tests are deterministic and do not rely on browser APIs.

Illegal engine operations throw typed `GameRuleError` values.

## Commands and state machine

Milestone 4 lives in `src/domain/stateMachine`. The discriminated `GameCommand` union is the only phase-aware gameplay entry point, and `processGameCommand` returns either an updated session with typed domain events or a structured, non-mutating rejection. Successful command IDs are retained in a bounded recent-history list so duplicate UI or service delivery cannot replay a score or side effect.

The legal transition table covers setup through the game summary. Media, suspense, timer, hint, score, and recovery events are effect requests only; the Domain Layer does not execute integrations. Recovery pauses running timer snapshots, requests media and suspense stops, and resumes at a host-controlled phase without autoplaying or restarting timers.

## Catalog and round builder

Milestone 5 adds catalog repository interfaces with in-memory and bundled static-JSON implementations. `loadCatalog` validates each source independently, excludes invalid or ambiguous songs, and returns structural, referential, semantic, and duplicate diagnostics without blocking valid content. Its detached snapshot is indexed by song, category, challenge, and category/level candidates.

Coverage analysis reports exact enabled challenge counts for every category and level. The round builder validates or deterministically creates all random/manual category and full-catalog/curated-pool combinations. Challenge selection respects curated approvals and permanent challenge exclusions; it avoids played songs when possible and explicitly reports when safe song reuse fallback was required.

## YouTube playback technical spike

Milestone 6 adds a generic `VideoPlayerService`, a YouTube IFrame adapter, and a playback coordinator under `src/services/video`. YouTube numeric states and error codes do not escape the adapter. The coordinator polls every 100 ms, pauses within the configured 0.15-second tolerance, records the observed pause time, prevents duplicate pause triggers, and supports verification replay, Retry, Restart, and cleanup.

The `/playback-spike` route uses the embeddable sample video from the official [YouTube IFrame API documentation](https://developers.google.com/youtube/iframe_api_reference). Loading and cueing do not start playback; the host must click **Play challenge**.

### Manual playback smoke test

1. Run `npm run dev` and open `http://localhost:5173/playback-spike` in desktop Chrome.
2. Wait for the coordinator to show `READY` and the player to show `CUED`.
3. Click **Play challenge**. Confirm playback starts around 5 seconds and pauses around 10 seconds.
   If the browser blocks API playback, click **Play challenge** again or click the play overlay inside the video.
4. Confirm **Actual pause** records the observed player time near 10 seconds.
5. Click **Replay verification**. Confirm playback seeks to about 7 seconds and stops around 12 seconds.
6. Click **Restart challenge** and confirm the challenge begins again from about 5 seconds.

This manual check requires internet access, an embeddable video, and a browser that permits playback after the host gesture. Automated tests use a fake player and never depend on live YouTube availability.

## Timer and audio services

Milestone 7 adds browser and fake implementations under `src/services/timer` and `src/services/audio`. The timer calculates remaining time from an injected wall clock rather than trusting interval frequency, emits expiration once, supports all documented host controls, and restores saved timers paused. Audio assets are supplied through a manifest; suspense and effects have independent volumes, suspense loops until explicitly stopped, and preload or playback failures are reported as recoverable events rather than blocking gameplay.

`ChallengePlaybackCoordinator` accepts these services as optional dependencies. When configured with a timer duration and suspense asset, it sequences automatic video pause → suspense start → timer start, then stops the timer and suspense before verification. Timer expiration remains a service event; the application must send the existing `TIMER_EXPIRED` command, whose domain handling deliberately does not classify the answer.

No production audio files or complete gameplay controls are added in this milestone. Those services are wired into the playable flow in Milestone 8.

## Minimal full gameplay

Milestone 8 replaces the `/game` placeholder with the complete phase-driven flow from team setup through the winner screen. React screens dispatch typed commands and render the resulting session; scoring, category consumption, steal eligibility, lifeline accounting, and level progression remain in the Domain Layer. A Zustand application store owns command metadata, deterministic challenge selection, rerolls, paid-lifeline confirmation, and recoverable command failures.

The normal `/game` route uses the YouTube adapter and an embedded fictional demo catalog with complete ten-category, five-level coverage. The catalog deliberately uses the official YouTube API sample video while Admin authoring and real party content remain future work. `/game?media=fake` replaces video, audio, and timer integrations with deterministic fakes for automated and rehearsal runs.

The gameplay shell includes score strips, contextual lifelines, host timer controls, safe pause, answer and steal reviews, verification-only lyric reveal, recommended and overridden score breakdowns, turn/level summaries, and the final winner.

## Refresh recovery and local persistence

Milestone 9 stores active games in schema-versioned Local Storage envelopes after meaningful
commands. Startup validates the saved envelope and always asks the host to **Resume saved game** or
**Discard saved game**; corrupt or unsupported data is preserved for export instead of being
silently replaced. Completed-game summaries are kept separately from the active game.

Resume passes through the domain recovery transition. Playback phases reopen at video ready, active
answer timers restore paused with their calculated remaining time, and suspense audio, timers, and
media never autoplay after refresh. If browser storage fails, gameplay continues in memory and the
host can export the current session as JSON.

### Manual refresh recovery test

1. Run `npm run dev` and open `http://localhost:5173/game?media=fake`.
2. Start a game, lock a challenge, click **Play challenge**, and refresh before simulating the
   challenge pause.
3. Confirm the Resume/Discard prompt appears. Click **Resume saved game** and verify the challenge
   is at **Play challenge**, not playing.
4. Play and simulate the pause, refresh during primary answering, and resume again.
5. Confirm the answer screen returns with the timer marked **PAUSED** and requires the host to click
   **Resume**.

## Saved Game Plans

Milestone 10 adds a schema-versioned Local Storage repository and a `/plans` workspace for preparing
multiple reusable games. Hosts can create, edit, rename, duplicate, delete, and validate plans;
choose manual or random categories; use the full catalog or curated challenge pools; adjust game
configuration; select a preferred theme; and control whether song details appear before playback.

Starting a plan validates it against the current catalog and creates a new detached `GameSession`.
Invalid plans cannot start. Plans with warnings require explicit host acceptance. Later plan edits
cannot alter an active game, and each reuse creates fresh teams, scores, category history, and stable
session identity.

### Manual Saved Game Plan test

1. Open `http://localhost:5173/plans` and create three differently named plans.
2. Edit one plan, choose its categories and settings, then click **Save and validate**.
3. Duplicate and rename it; confirm both plans remain independently editable.
4. For a curated plan, click **Approve all current demo challenges**, save, and validate.
5. Click **Play**, enter two team names, and start the independent game.
6. Return to Plans and edit the source plan; confirm the active game retains its original settings.

## Admin song and challenge authoring

Milestone 11 replaces the Admin placeholder with a local authoring workspace. The song library
supports continuous scrolling, search, category/status/level filters, sorting, creation,
duplication, enable/disable, guarded deletion, and explicit-save editing. The editor parses common
YouTube URL forms, keeps stable song IDs, validates metadata and challenge time ordering, offers
manual/capture/nudge timestamp controls, and previews against the same playback coordinator used by
Game Mode.

Milestone 11.5 Part 1 adds validated category creation and editing. Category IDs are generated once
and remain read-only so renaming a category cannot break song, Game Plan, or session references.
Category changes are saved through the local Admin API with a backup and atomic replacement of
`data/categories.json`; unsafe category deletion remains intentionally unavailable.

Milestone 11.5 Part 2 keeps every configured category visible throughout category selection.
Committed categories remain in their original round order, show a checkmark and the consuming team,
and use a semantically disabled button so they cannot be selected again. Attribution is derived from
the existing persisted category history, so saved games require no migration and retain the same
information after recovery.

Milestone 11.5 Part 3 adds word-level lyric puzzles. Challenge authors enter the complete acceptable
lyrics, select any individual words to hide, see an exact gameplay preview, and save the selection as
zero-based `hiddenWordIndexes`. Editing the lyric text clears the old selection for explicit review.
Older challenges without this field intentionally render with every lyric word hidden and are
migrated to that explicit selection when reopened and saved in Admin.

Milestone 11.5 Part 4 adds **Jump to challenge (-5s)** to the isolated Admin preview. The playback
coordinator calculates the clamped seek target, starts normal challenge playback, and uses the same
polling path to pause at the configured timestamp. Preview diagnostics show the requested start,
duration, lifecycle, actual pause, and deviation; readiness, duration, seeking, playback, and
autoplay errors remain visible and recoverable without changing game-session state.

Coverage and validation views expose catalog gaps and file/schema issues. Import validates the
entire candidate set before replacing files; export can download either the whole catalog or a
single song. Save, update, delete, and import writes use temporary files or directories and atomic
renames. Existing records are copied to timestamped folders under `data/backups` before destructive
changes.

The browser never writes project files directly. `npm run admin` builds and starts the loopback-only
Node API that owns those operations. Its data root defaults to `data` and can be overridden with
`LYRIC_LOCKOUT_DATA_DIR`; its port can be changed with `ADMIN_PORT`.

### Manual Admin test

1. Start `npm run admin` and `npm run dev` in separate terminals, then open
   `http://localhost:5173/admin`.
2. Open **Songs**, click **Add song**, paste a valid YouTube URL, and complete the metadata.
3. Add a challenge, set its start/pause/verification timestamps, and run the preview controls.
4. Save the song. Confirm it appears in the library and that Coverage and Validation update.
5. Disable and re-enable the song, then duplicate it. Confirm the copies remain independently
   editable.
6. Delete the duplicate through the confirmation step and confirm a backup notice appears.
7. Open **Categories**, create a category, then edit its display name. Confirm its displayed ID does
   not change and that the category remains after refreshing Admin.
8. Stop the Admin API and refresh. Confirm the authoring workspace reports it is offline while
   `/game` remains available.

### Manual consumed-category test

1. Start a fake-media game and select the first category for Alpha.
2. Lock and complete the challenge through the turn summary.
3. On the second category selection, confirm all ten categories are still shown in the same order.
4. Confirm the first category says **Used by Alpha**, displays a checkmark, and cannot be clicked.
5. Confirm every remaining category is still selectable.
6. Refresh during the active game, resume, and continue to category selection; confirm the same
   consumed state and team attribution remain.

### Manual hidden-lyrics test

1. In Admin, open a song challenge and replace **Acceptable lyrics** with a line containing repeated
   words, punctuation, and an apostrophe.
2. Select several non-adjacent word chips. Confirm the hidden count and gameplay preview update, then
   use **Select all words** and **Clear hidden words**.
3. Confirm clearing prevents save, select at least one word, save, reopen the song, and verify the
   same chips remain selected.
4. Start a fake-media game using the challenge. After the video pauses, confirm visible lyric words
   and one fixed-width blank per selected hidden word appear in both primary and steal answering.
5. Complete the answer decisions and confirm verification reveals the full acceptable lyrics.

### Manual jump-to-challenge test

1. Restart `npm run admin`, open a song challenge, and set its pause timestamp to at least 10 seconds.
2. Wait for the preview lifecycle to show **READY**, then click **Jump to challenge (-5s)**.
3. Confirm **Requested start** is five seconds before the pause timestamp and playback begins there.
4. Confirm playback automatically reaches **PAUSED_AT_CHALLENGE** and records its timing deviation.
5. Set the pause timestamp below five seconds and confirm the requested start is `0.00s`.
6. Use **Pause preview**, normal challenge playback, verification playback, restart, and retry to
   confirm the existing preview workflow remains available and isolated from an active game.

## Theme foundation

The shell uses semantic CSS tokens. Startup explicitly applies `day-party`, the required default theme, to the document root. Theme selection and persistence belong to Milestone 12 and are intentionally not implemented here.

## Scope

Milestone 1 includes the Vite/React/TypeScript scaffold, routing, Day Party shell, and development
tooling. Milestone 2 adds authoritative models, schemas, defaults, and sample data. Milestone 3 adds
pure gameplay rules and full-game simulation. Milestone 4 adds commands, events, controlled phase
transitions, duplicate protection, timer-control requests, and recovery metadata. Milestone 5 adds
catalog loading, indexes, coverage, round building, and eligible challenge selection. Milestone 6
proves isolated YouTube playback and pause synchronization. Milestone 7 adds timer and audio
abstractions, browser implementations, deterministic fakes, and media sequencing. Milestone 8 adds
the complete minimal gameplay UI and end-to-end fake-media game. Milestone 9 adds versioned
active-session persistence, startup Resume/Discard recovery, paused timer/media restoration,
recovery export, and completed-game summaries. Milestone 10 adds reusable Saved Game Plans, plan
validation, curated pools, warning-gated starts, and independent session copies. Milestone 11 adds
the local Admin API and song/challenge authoring, coverage, validation, preview, atomic persistence,
backup, and import/export workflows. The project still intentionally excludes advanced animation,
custom theming, and release-candidate hardening.

## Milestone prompts

All implementation prompts are saved in `prompts/01_Foundation.md` through `prompts/15_Release_Candidate.md` and indexed by `prompts/README.md`. Execute one numbered prompt at a time after reading `prompts/00_Master_Prompt.md`, verify it completely, and stop before starting the next milestone.

Authoritative project documents are in [`docs/`](docs), with milestone working rules in [`prompts/00_Master_Prompt.md`](prompts/00_Master_Prompt.md).
