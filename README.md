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
npm run dev
```

NVM keeps the project Node version separate from Conda environments and other projects. If NVM is not used, install a compatible Node.js 24 release directly and start with `npm install`.

Vite prints the local URL, normally `http://localhost:5173`.

## Quality checks

```bash
npm run typecheck
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

| Route             | Purpose                                             |
| ----------------- | --------------------------------------------------- |
| `/`               | Home and application entry point                    |
| `/game`           | Complete two-team, five-level host-led game         |
| `/playback-spike` | Isolated YouTube playback and pause-point rehearsal |
| `/admin`          | Placeholder for catalog authoring tools             |
| `/settings`       | Placeholder for display, audio, and theme settings  |
| any unknown route | Friendly not-found screen                           |

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
| `server`           | Optional local Admin API, introduced in a later milestone   |

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

## Theme foundation

The shell uses semantic CSS tokens. Startup explicitly applies `day-party`, the required default theme, to the document root. Theme selection and persistence belong to Milestone 12 and are intentionally not implemented here.

## Scope

Milestone 1 includes the Vite/React/TypeScript scaffold, routing, Day Party shell, and development tooling. Milestone 2 adds authoritative models, schemas, defaults, and sample data. Milestone 3 adds pure gameplay rules and full-game simulation. Milestone 4 adds commands, events, controlled phase transitions, duplicate protection, timer-control requests, and recovery metadata. Milestone 5 adds catalog loading, indexes, coverage, round building, and eligible challenge selection. Milestone 6 proves isolated YouTube playback and pause synchronization. Milestone 7 adds timer and audio abstractions, browser implementations, deterministic fakes, and media sequencing. Milestone 8 adds the complete minimal gameplay UI and end-to-end fake-media game. The project still intentionally excludes persistence, Saved Game Plans, real party catalog authoring, advanced animation, and Admin CRUD.

## Milestone prompts

All implementation prompts are saved in `prompts/01_Foundation.md` through `prompts/15_Release_Candidate.md` and indexed by `prompts/README.md`. Execute one numbered prompt at a time after reading `prompts/00_Master_Prompt.md`, verify it completely, and stop before starting the next milestone.

Authoritative project documents are in [`docs/`](docs), with milestone working rules in [`prompts/00_Master_Prompt.md`](prompts/00_Master_Prompt.md).
