# Lyric Lockout
## Engineering Specification

**Version:** 1.0  
**Status:** Frozen for MVP Implementation  
**Authoritative Gameplay Source:** `01_Game_Design_Document.md`  
**Project Type:** Local-first Web Party Game  
**Primary Platform:** Laptop connected to a television or projector  
**Owner:** Ashish Magar  
**Last Updated:** July 2026

---

# Document Authority

This Engineering Specification defines how Lyric Lockout MVP Version 1 will be implemented.

The frozen Game Design Document defines what the game does. This document defines how the application will deliver that behavior.

If gameplay behavior in this document conflicts with the Game Design Document, the Game Design Document takes precedence. If an older HLD, amendment, chat discussion, mockup, or implementation note conflicts with this document, this document takes precedence for MVP Version 1.

---

# Revision History

| Version | Date | Description |
|---|---|---|
| 1.0 | July 2026 | Consolidated MVP engineering specification |

---

# Table of Contents

1. Engineering Goals  
2. Scope and Constraints  
3. Architecture Overview  
4. Recommended Technology Stack  
5. Deployment Model  
6. Application Modes  
7. System Context  
8. Major Modules  
9. Module Dependency Rules  
10. Project Structure  
11. Engineering Principles  
12. Architecture Decisions  
13. Domain Model Overview  
14. Core Enumerations  
15. Catalog Data Model  
16. Round Configuration Model  
17. Game Session Model  
18. Team and Score Models  
19. Answer Attempt Model  
20. Lifeline Model  
21. Timer Model  
22. Host Override Model  
23. Challenge Selection Model  
24. Game State Machine  
25. State Transition Rules  
26. Category Consumption Rules  
27. Trivia and Turn-Order Handling  
28. Primary Challenge Lifecycle  
29. Steal Lifecycle  
30. Verification and Scoring Lifecycle  
31. Score Calculation Rules  
32. Lifeline Accounting Rules  
33. Timer Behavior  
34. Reroll Behavior  
35. Recovery State Rules  
36. Domain Invariants  
37. Application Command Model  
38. Domain Event Model  
39. Command Execution Flow  
40. Repository Interfaces  
41. JSON Catalog Organization  
42. JSON Schema Validation  
43. Catalog Loading and Indexing  
44. Catalog Coverage Analysis  
45. Game Persistence Architecture  
46. Session Save and Restore  
47. YouTube Player Adapter  
48. Playback Synchronization  
49. Challenge Playback Coordinator  
50. Audio Service  
51. Timer Service  
52. Application Store  
53. Admin Write Architecture  
54. Admin API Contract  
55. Import, Export, and Backup  
56. Error Model  
57. Error Recovery Workflows  
58. Logging and Diagnostics  
59. Security and Privacy  
60. UI Design Philosophy  
61. Navigation and Global Layout  
62. Gameplay Experience and Screen Flow  
63. Admin Experience and Content Authoring  
64. Theme Architecture  
65. Reusable Components and Interaction Standards  
66. Continuous Scrolling  
67. Saved Game Plans  
68. Party Check and How to Play Demo  
69. Testing Strategy  
70. Performance and Compatibility  
71. Development Standards  
72. Build, Deployment, and Release  
73. Implementation Milestones  
74. MVP Risk Register  
75. Traceability and Final Acceptance  
76. Specification Freeze and Codex Handoff

---

# 1. Engineering Goals

## 1.1 Reliable Party Gameplay

The application must remain usable throughout a complete game without requiring a restart. The host should always have a recovery path when a video fails, a timestamp is incorrect, a score is entered incorrectly, a timer needs adjustment, an unsuitable song is selected, the browser is refreshed, suspense audio does not play, or a challenge cannot be completed normally.

Reliability is more important than strict automation.

## 1.2 Fast MVP Development

The architecture should be clean enough to support future growth but simple enough for a single developer using Codex to build incrementally.

The MVP should avoid distributed infrastructure, cloud dependencies, complex authentication, microservices, unnecessary databases, premature mobile support, and premature multi-device synchronization.

## 1.3 Clear Separation of Responsibilities

Gameplay rules must not be embedded directly in user-interface components. Separate game rules, game state, media playback, timer behavior, score calculation, persistence, catalog access, and rendering.

## 1.4 Local-First Operation

The application should run primarily on one laptop. Internet access is required only for YouTube playback and any intentionally hosted assets.

The following remain local:

- game state;
- team names;
- scores;
- configuration;
- song metadata;
- challenge timestamps;
- suspense audio;
- sound effects;
- Admin edits;
- Saved Game Plans.

## 1.5 Maintainable Song Catalog

Adding or modifying a song should not require changing application code. The catalog should be human-readable, version-control friendly, easy to back up, easy to validate, and easy to migrate later.

## 1.6 Host-Centered Control

The host must be able to override score, answer classification, steal classification, timer, song selection, turn order, category assignment, and challenge progression.

---

# 2. Scope and Constraints

## 2.1 MVP Scope

The MVP includes:

- two-team gameplay;
- five difficulty levels;
- ten categories per round;
- category consumption across the entire round;
- host-entered turn order at every level;
- random and manual category selection;
- full-catalog and curated challenge-pool selection;
- YouTube lyric or karaoke video playback;
- automatic pause at a configured timestamp;
- suspense audio;
- answer timers;
- Hint and Team Huddle lifelines;
- paid lifeline penalties;
- primary-answer classification;
- steal opportunities;
- score calculation;
- score overrides;
- song rerolling;
- active-game persistence;
- Admin song and challenge management;
- challenge timestamp authoring;
- challenge preview and validation;
- Day Party and Game Night themes;
- Saved Game Plans;
- Party Check;
- How to Play Demo;
- continuous scrolling for large lists.

## 2.2 MVP Exclusions

The MVP does not include automatic speech recognition, automatic lyric comparison, AI scoring, online multiplayer, native mobile applications, user accounts, cloud synchronization, community submissions, public catalog sharing, monetization, tournament brackets, real-time host and viewer synchronization, downloading YouTube media, microphone recording, or detailed analytics.

## 2.3 Expected Scale

The application is expected to support tens to hundreds of songs initially, potentially a few thousand songs later, one or more challenges per difficulty for each song, one active game at a time, multiple Saved Game Plans, a small amount of history, and one administrative user.

## 2.4 Browser Target

Primary target: current desktop Google Chrome.

Secondary targets: Microsoft Edge, Safari on macOS, and Firefox.

## 2.5 Display Target

Primary gameplay resolution:

```text
1920 × 1080
```

Minimum supported:

```text
1366 × 768
```

---

# 3. Architecture Overview

## 3.1 Architecture Style

Lyric Lockout will use a local-first, modular, single-page web application consisting of a React UI, pure TypeScript Game Engine, explicit state machine, repository abstraction, YouTube adapter, audio service, timer service, persistence service, and optional local Admin API.

## 3.2 High-Level Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                    Lyric Lockout Web App                    │
│                                                             │
│  Presentation: Game • Plans • Check • Demo • Admin         │
│                              │                              │
│  Application: Commands • Use Cases • Coordinators • Store  │
│                              │                              │
│  Domain: Game Engine • State Machine • Rules • Plans       │
│                              │                              │
│  Integration: YouTube • Audio • Timer • Persistence        │
│                              │                              │
│  Data: Songs • Categories • Plans • Sessions • Settings   │
└──────────────────────────────┬──────────────────────────────┘
                               │
             JSON • Local Storage • Local API • YouTube
```

## 3.3 Runtime Flow

1. Load categories, songs, settings, and Saved Game Plans.
2. Validate the catalog.
3. Build in-memory indexes.
4. Create, load, or resume a game.
5. Game Engine validates commands and calculates the next state.
6. Application layer executes media, audio, timer, and persistence side effects.
7. UI renders the current phase.
8. Every meaningful state change is persisted.

---

# 4. Recommended Technology Stack

## 4.1 Frontend

```text
React
TypeScript
Vite
React Router
Zustand
Zod
```

## 4.2 Testing

```text
Vitest
React Testing Library
Playwright
axe-core
```

## 4.3 Styling

Use CSS Modules or Tailwind CSS with semantic design tokens. No component should hardcode theme-specific colors.

## 4.4 Media

```text
YouTube IFrame Player API
HTMLAudioElement or Web Audio API
```

## 4.5 Persistence

```text
JSON files
Browser Local Storage
Optional Node.js Admin API
```

## 4.6 Optional Local Backend

Recommended for direct Admin writes:

```text
Node.js
TypeScript
Express or Fastify
```

---

# 5. Deployment Model

## 5.1 MVP Deployment

```text
Laptop Browser
   ├── Game UI
   ├── Host controls
   ├── YouTube playback
   ├── Suspense audio
   └── Local game state
          ↓
     TV or Projector
```

## 5.2 Local Development

```text
Frontend: http://localhost:5173
Admin API: http://localhost:3001
```

## 5.3 Production-Like Local Deployment

Supported options are a static frontend with a read-only catalog, a local frontend plus Admin API, and a future desktop wrapper using Tauri or Electron. Desktop packaging is not required for MVP.

---

# 6. Application Modes

## 6.1 Game Mode

Includes game setup, Saved Game Plan selection, level introduction, trivia result entry, turn order, category assignment, challenge preview, playback, primary answer, steal, verification, score review, summaries, and winner.

## 6.2 Admin Mode

Includes song management, challenge authoring, timestamp capture, category management, validation, coverage, import/export, and Saved Game Plan preparation.

## 6.3 Party Check

Tests display, internet, YouTube, song audio, automatic pause, suspense audio, timer controls, verification, and persistence.

## 6.4 How to Play Demo

Demonstrates category strategy, challenge preview, playback and pause, lifelines, primary result, steal, verification, and scoring.

## 6.5 Viewer Mode

A separate viewer-only device is deferred. MVP uses one shared screen with collapsible host controls.

---

# 7. System Context

## 7.1 Actors

### Host

Controls setup, trivia results, category assignment, playback recovery, timers, scoring, and Admin tools.

### Team A and Team B

Each team receives one primary challenge per level and may attempt steals.

### Spectators

Observe the shared screen.

### Administrator

Usually the same person as the host.

## 7.2 External Systems

YouTube provides embedded media. The browser provides rendering, audio, timers, and Local Storage. The local file system stores catalog, plans, configuration, and backups through the local Admin API.

---

# 8. Major Modules

- Application Shell
- Game Engine
- Game State Machine
- Round Builder
- Challenge Selection Service
- YouTube Player Service
- Challenge Playback Coordinator
- Audio Service
- Timer Service
- Lifeline Service
- Scoring Service
- Persistence Service
- Song Repository
- Game Plan Repository
- Admin Module
- Party Check Coordinator
- Demo Coordinator

The Game Engine is authoritative and must not depend on React, DOM, YouTube, Local Storage, or CSS.

---

# 9. Module Dependency Rules

Allowed:

```text
UI → Application Layer → Domain Layer
Application Layer → Integration Services
Repositories → Local files or API
```

Forbidden:

- Domain importing React;
- Domain importing Zustand;
- Domain importing YouTube;
- UI directly changing scores or category history;
- YouTube adapter deciding game rules.

---

# 10. Project Structure

```text
LyricLockout/
├── README.md
├── docs/
│   ├── 01_Game_Design_Document.md
│   ├── 02_Engineering_Spec.md
│   ├── 03_Codex_Implementation_Guide.md
│   └── ...
├── data/
│   ├── categories.json
│   ├── game-config.json
│   ├── songs/
│   ├── game-plans/
│   ├── demo/
│   └── backups/
├── public/
│   ├── audio/
│   └── images/
├── server/
├── src/
│   ├── app/
│   ├── domain/
│   ├── application/
│   ├── services/
│   ├── repositories/
│   ├── schemas/
│   ├── store/
│   ├── features/
│   ├── components/
│   ├── utils/
│   └── tests/
└── prompts/
```

---

# 11. Engineering Principles

- Keep domain logic pure.
- Use explicit game phases instead of many Booleans.
- Persist after meaningful actions.
- Recover into a paused, host-controlled state.
- Preserve recommended and overridden scores.
- Fail media gracefully.
- Validate catalog early.
- Version persisted data.
- Avoid premature abstraction.
- Build in vertical slices.
- Prefer guided transitions over abrupt route changes.

---

# 12. Architecture Decisions

- Browser-based application.
- React and TypeScript.
- Local-first architecture.
- One JSON file per song.
- Repository abstractions.
- Manual host judging.
- Pause-based challenges.
- Explicit state machine.
- Combined host and viewer display for MVP.
- Optional local Admin API.
- Two-theme semantic token system.
- Continuous scrolling for large lists.
- Curated challenge pools instead of exact scripting.
- Saved Game Plans.
- Party Check and How to Play Demo.

---

# 13. Domain Model Overview

The primary aggregate is `GameSession`.

```typescript
interface GameEngineResult {
  session: GameSession;
  events: DomainEvent[];
}
```

The Domain Layer returns events and does not directly execute media or persistence side effects.

---

# 14. Core Enumerations

```typescript
type DifficultyLevel = 1 | 2 | 3 | 4 | 5;

type GameStatus =
  | "DRAFT"
  | "READY"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "ABANDONED";

type GamePhase =
  | "GAME_SETUP"
  | "ROUND_BUILDING"
  | "ROUND_VALIDATION"
  | "LEVEL_INTRO"
  | "TRIVIA_RESULT_ENTRY"
  | "TURN_ORDER_CONFIRMATION"
  | "CATEGORY_ASSIGNMENT"
  | "CHALLENGE_SELECTION"
  | "CHALLENGE_PREVIEW"
  | "VIDEO_LOADING"
  | "VIDEO_READY"
  | "VIDEO_PLAYING"
  | "PRIMARY_ANSWERING"
  | "PRIMARY_RESULT_REVIEW"
  | "STEAL_OFFER"
  | "STEAL_ANSWERING"
  | "STEAL_RESULT_REVIEW"
  | "CHALLENGE_VERIFICATION"
  | "FINAL_SCORE_REVIEW"
  | "TURN_SUMMARY"
  | "LEVEL_SUMMARY"
  | "GAME_SUMMARY"
  | "RECOVERY"
  | "ERROR";

type AnswerResult =
  | "PERFECT"
  | "MOSTLY_CORRECT"
  | "WRONG"
  | "DECLINED";

type AttemptType = "PRIMARY" | "STEAL";
type LifelineType = "HINT" | "TEAM_HUDDLE";
type SelectionMode = "RANDOM" | "MANUAL";
type ThemeName = "DAY_PARTY" | "GAME_NIGHT";
```

Default configuration:

```typescript
const DIFFICULTY_CONFIG = {
  1: { fullPoints: 100, answerSeconds: 30 },
  2: { fullPoints: 200, answerSeconds: 45 },
  3: { fullPoints: 300, answerSeconds: 60 },
  4: { fullPoints: 400, answerSeconds: 90 },
  5: { fullPoints: 500, answerSeconds: 120 }
};
```

---

# 15. Catalog Data Model

```typescript
interface Song {
  id: string;
  schemaVersion: number;
  title: string;
  artist: string;
  youtubeVideoId: string;
  videoType: "LYRIC" | "KARAOKE" | "OFFICIAL_VIDEO" | "OTHER";
  categoryIds: string[];
  language?: string;
  releaseYear?: number;
  movieOrAlbum?: string;
  thumbnailUrl?: string;
  enabled: boolean;
  notes?: string;
  challenges: Challenge[];
  createdAt: string;
  updatedAt: string;
}

interface Category {
  id: string;
  schemaVersion: number;
  name: string;
  description?: string;
  icon?: string;
  displayOrder: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Challenge {
  id: string;
  difficulty: DifficultyLevel;
  playbackStartSeconds: number;
  pauseAtSeconds: number;
  verifyFromSeconds: number;
  verifyToSeconds?: number;
  expectedLyrics: string;
  missingWordCount: number;
  hintText: string;
  enabled: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
```

Validation:

```text
playbackStartSeconds >= 0
verifyFromSeconds >= 0
pauseAtSeconds > playbackStartSeconds
pauseAtSeconds > verifyFromSeconds
verifyToSeconds > pauseAtSeconds, when present
missingWordCount > 0
expectedLyrics not blank
hintText not blank
difficulty between 1 and 5
```

---

# 16. Round Configuration Model

```typescript
interface RoundCreationConfig {
  categorySelectionMode: SelectionMode;
  songSelectionMode: "FULL_CATALOG" | "CURATED_POOL";
  categoryCount: 10;
  difficultyLevels: [1, 2, 3, 4, 5];
  selectedCategoryIds: string[];
  manualChallengePools: ManualChallengePool[];
  preventChallengeReuse: boolean;
  preventSongReuse: boolean;
  allowRuntimeReroll: boolean;
  randomSeed?: string;
}

interface ManualChallengePool {
  categoryId: string;
  approvedChallengeIdsByDifficulty:
    Partial<Record<DifficultyLevel, string[]>>;
}
```

Supported modes:

1. Random categories + full catalog
2. Random categories + curated pools
3. Manual categories + full catalog
4. Manual categories + curated pools

---

# 17. Game Session Model

```typescript
interface GameSession {
  schemaVersion: number;
  id: string;
  status: GameStatus;
  phase: GamePhase;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  roundConfig: RoundCreationConfig;
  gameConfig: GameConfig;
  teams: [TeamState, TeamState];
  currentDifficulty: DifficultyLevel;
  currentLevelState: LevelState;
  consumedCategoryIds: string[];
  categoryHistory: CategorySelectionRecord[];
  playedSongIds: string[];
  playedChallengeIds: string[];
  rejectedChallengeIds: string[];
  activeTurn?: ActiveTurn;
  activeChallenge?: ActiveChallenge;
  turnHistory: TurnResult[];
  levelHistory: LevelResult[];
  processedCommandIds: string[];
  recovery?: RecoveryState;
  error?: GameError;
}
```

```typescript
interface GameConfig {
  freeHintUsesPerTeam: number;
  freeTeamHuddleUsesPerTeam: number;
  additionalLifelinePenaltyPoints: number;
  fullPointsByDifficulty: Record<DifficultyLevel, number>;
  answerSecondsByDifficulty: Record<DifficultyLevel, number>;
  stealTimerMode:
    | "FIXED"
    | "REMAINING_PRIMARY_TIME"
    | "FULL_LEVEL_TIME"
    | "HOST_CONTROLLED";
  stealTimerSeconds: number;
  allowLifelinesDuringSteal: boolean;
  scoreFloorAtZero: boolean;
  allowHostScoreOverride: boolean;
  allowHostTimerOverride: boolean;
  allowSongReroll: boolean;
  revealSongBeforePlayback: boolean;
}
```

---

# 18. Team and Score Models

```typescript
interface TeamState {
  id: string;
  name: string;
  score: number;
  lifelines: TeamLifelineState;
  primaryChallengeCount: number;
  stealAttemptCount: number;
  correctPrimaryCount: number;
  mostlyCorrectPrimaryCount: number;
  wrongPrimaryCount: number;
  successfulStealCount: number;
}

interface ScoreBreakdown {
  fullChallengePoints: number;
  baseAllocatedPoints: number;
  lifelinePenaltyPoints: number;
  hostAdjustmentPoints: number;
  recommendedPoints: number;
  finalAwardedPoints: number;
  overridden: boolean;
  overrideReason?: string;
}
```

---

# 19. Answer Attempt Model

```typescript
interface AnswerAttempt {
  id: string;
  teamId: string;
  attemptType: "PRIMARY" | "STEAL";
  result?: AnswerResult;
  startedAt: string;
  completedAt?: string;
  timer: ChallengeTimerState;
  lifelinesUsed: LifelineUsage[];
  hostClassificationConfirmed: boolean;
}
```

A steal does not consume a category, primary turn, or later normal turn.

---

# 20. Lifeline Model

```typescript
interface TeamLifelineState {
  hintUseCount: number;
  teamHuddleUseCount: number;
}

interface LifelineUsage {
  id: string;
  teamId: string;
  attemptId: string;
  type: "HINT" | "TEAM_HUDDLE";
  usageNumber: number;
  wasFree: boolean;
  penaltyPoints: number;
  usedAt: string;
}
```

Team Huddle uses the canonical `TEAM_HUDDLE`, `teamHuddleUseCount`, and
`freeTeamHuddleUsesPerTeam` identifiers throughout the domain and persistence models.

Rules:

- first Hint free;
- first Team Huddle free;
- later uses cost 25 points each;
- no reset between levels;
- steal usage counts against the same team;
- paid usage requires confirmation.

---

# 21. Timer Model

```typescript
interface ChallengeTimerState {
  configuredSeconds: number;
  remainingMilliseconds: number;
  status: TimerStatus;
  startedAt?: string;
  lastResumedAt?: string;
  expiredAt?: string;
  completedAt?: string;
  pauseHistory: TimerPauseRecord[];
  adjustments: TimerAdjustment[];
}
```

Use wall-clock calculation rather than decrementing once per second.

---

# 22. Host Override Model

```typescript
interface HostOverride {
  id: string;
  type:
    | "SCORE"
    | "TIMER"
    | "TURN_ORDER"
    | "CATEGORY_ASSIGNMENT"
    | "ANSWER_RESULT"
    | "STEAL_RESULT"
    | "LIFELINE_PENALTY"
    | "CHALLENGE_SELECTION"
    | "GAME_PHASE";
  targetId?: string;
  previousValue?: unknown;
  newValue: unknown;
  reason?: string;
  createdAt: string;
}
```

Reasons are optional.

---

# 23. Challenge Selection Model

```typescript
interface ChallengeReference {
  songId: string;
  challengeId: string;
  categoryId: string;
  difficulty: DifficultyLevel;
}

interface ChallengeSelectionRequest {
  categoryId: string;
  difficulty: DifficultyLevel;
  songSelectionMode: "FULL_CATALOG" | "CURATED_POOL";
  approvedChallengeIds?: string[];
  excludedChallengeIds: string[];
  excludedSongIds: string[];
  allowSongReuseFallback: boolean;
}
```

Selection priority:

1. category;
2. level;
3. enabled song;
4. enabled challenge;
5. approved pool;
6. not previously played;
7. not rejected this turn;
8. avoid previously played songs;
9. random among candidates.

---

# 24. Game State Machine

```text
GAME_SETUP
  ↓
ROUND_BUILDING
  ↓
ROUND_VALIDATION
  ↓
LEVEL_INTRO
  ↓
TRIVIA_RESULT_ENTRY
  ↓
TURN_ORDER_CONFIRMATION
  ↓
CATEGORY_ASSIGNMENT
  ↓
CHALLENGE_SELECTION
  ↓
CHALLENGE_PREVIEW
  ├── Reroll → CHALLENGE_SELECTION
  ↓
VIDEO_LOADING
  ↓
VIDEO_READY
  ↓
VIDEO_PLAYING
  ↓
PRIMARY_ANSWERING
  ↓
PRIMARY_RESULT_REVIEW
  ├── PERFECT → CHALLENGE_VERIFICATION
  ├── MOSTLY_CORRECT → STEAL_OFFER
  └── WRONG → STEAL_OFFER
                 ↓
          STEAL_ANSWERING
                 ↓
          STEAL_RESULT_REVIEW
                 ↓
      CHALLENGE_VERIFICATION
                 ↓
        FINAL_SCORE_REVIEW
                 ↓
            TURN_SUMMARY
                 ↓
        next turn / level / game
```

---

# 25. State Transition Rules

- two team names before creation;
- exactly ten categories before validation;
- no start with blocking errors;
- host records trivia winner and first team every level;
- assignment uses an unconsumed category;
- category is consumed when challenge is confirmed and playback begins;
- failed media before attempt may restore category;
- Perfect primary skips steal;
- Mostly Correct or Wrong offers steal;
- verification only after steal resolution;
- score only after final confirmation;
- level after two primary turns;
- game after both Level 5 turns.

---

# 26. Category Consumption Rules

Categories remain consumed across all five levels.

```text
10 primary turns = 10 consumed categories
```

A steal never consumes a category.

---

# 27. Trivia and Turn-Order Handling

Trivia is external. The host records trivia winner, first-playing team, and category assignment result.

The application supports self-selected, opponent-assigned, and host-assigned categories without enforcing verbal strategy.

---

# 28. Primary Challenge Lifecycle

Primary attempt begins only after successful video pause.

The host selects Perfect, Mostly Correct, or Wrong.

Expected lyrics remain hidden before steal resolution.

---

# 29. Steal Lifecycle

```text
Perfect primary → no steal
Mostly Correct primary → steal
Wrong primary → steal
```

Default steal timer: 30 seconds.

Only a Perfect steal earns points.

---

# 30. Verification and Scoring Lifecycle

1. stop suspense;
2. stop timer;
3. seek to verification start;
4. play video;
5. stop at optional endpoint;
6. allow Replay;
7. review score;
8. confirm once.

---

# 31. Score Calculation Rules

| Level | Full | Half |
|---|---:|---:|
| 1 | 100 | 50 |
| 2 | 200 | 100 |
| 3 | 300 | 150 |
| 4 | 400 | 200 |
| 5 | 500 | 250 |

| Primary | Steal | Primary | Steal |
|---|---|---:|---:|
| Perfect | None | Full | 0 |
| Mostly Correct | Perfect | Half | Half |
| Mostly Correct | Other | Half | 0 |
| Wrong | Perfect | 0 | Half |
| Wrong | Other | 0 | 0 |

Paid lifeline: minus 25 points each.

Recommended score floor is zero; host may override.

---

# 32. Lifeline Accounting Rules

- one free Hint per team;
- one free Team Huddle per team;
- unlimited paid uses;
- every paid use costs 25;
- no level reset;
- penalty attaches to current attempt;
- no use after classification.

---

# 33. Timer Behavior

| Level | Time |
|---|---:|
| 1 | 30 sec |
| 2 | 45 sec |
| 3 | 60 sec |
| 4 | 90 sec |
| 5 | 120 sec |

Host may pause, resume, restart, add, subtract, disable, or end.

Expiry does not automatically mark Wrong or reveal.

---

# 34. Reroll Behavior

Reroll preserves team, opponent, category, level, and turn order.

Rejected challenge is excluded for that turn.

No automatic penalty or hard limit.

---

# 35. Recovery State Rules

After refresh, do not autoplay media, resume suspense, or silently run timers.

Restore timer paused and return to a safe host-controlled phase.

---

# 36. Domain Invariants

- exactly two teams;
- ten unique categories;
- five levels;
- two primary turns per level;
- no consumed category reuse;
- no challenge reuse;
- one active primary turn;
- steal requires primary attempt;
- verification follows steal resolution;
- only Perfect steal earns;
- score applies once;
- overrides preserve recommendation.

---

# 37. Application Command Model

All changes occur through explicit commands with unique `commandId` values.

Command groups include setup, level/trivia, category/challenge, playback, answer, lifeline, timer, score, and progression.

Retain recent processed IDs to prevent duplicate handling.

---

# 38. Domain Event Model

Events request side effects such as video load, play, pause, seek, suspense start/stop, timer start/expiry, lifeline confirmation, hint display, and score recommendation.

The Domain Layer returns events; the Application Layer performs the effects.

---

# 39. Command Execution Flow

```text
Host or service event
  ↓
Application command
  ↓
Validation
  ↓
Game Engine
  ├── Updated session
  └── Domain events
        ↓
Coordinator
  ├── Store
  ├── Persist
  ├── Media
  ├── Audio
  └── Timer
```

---

# 40. Repository Interfaces

Provide repositories for songs, categories, Game Plans, sessions, and settings.

Repositories hide JSON, Local Storage, or API details from the rest of the application.

---

# 41. JSON Catalog Organization

```text
data/
├── categories.json
├── game-config.json
├── songs/
├── game-plans/
├── demo/
└── backups/
```

Lookup uses internal IDs, not filenames.

---

# 42. JSON Schema Validation

Use Zod for songs, categories, Game Plans, settings, imports, and persisted sessions.

Validation is structural, referential, and semantic.

One invalid song must not block the entire catalog.

---

# 43. Catalog Loading and Indexing

Build in-memory maps for songs, categories, challenge IDs, and category/level candidates.

Active games use a snapshot and are not affected by later Admin edits.

---

# 44. Catalog Coverage Analysis

Display category × level counts.

A category is Ready with at least one challenge at every level.

Recommend two or three or more per category per level for rerolling and replayability.

---

# 45. Game Persistence Architecture

Use Local Storage for active game, settings, team names, completed summaries, and Party Check result.

Persist after meaningful commands, not every timer tick.

Use schema-versioned envelopes.

---

# 46. Session Save and Restore

Startup loads settings and catalog, detects an active session, validates it, and offers Resume or Discard.

Persist active challenge snapshots so catalog edits do not break an active game.

---

# 47. YouTube Player Adapter

The generic player interface supports initialize, load, play, pause, seek, current time, duration, state, volume, subscriptions, and cleanup.

Do not expose YouTube numeric states outside the adapter.

---

# 48. Playback Synchronization

Poll current time every approximately 100 ms.

Pause near the configured timestamp with about 0.15 seconds tolerance.

Prevent duplicate pause triggers and record actual pause time.

---

# 49. Challenge Playback Coordinator

Coordinates loading, playback, polling, pause, suspense, timer, verification, and cleanup.

YouTube and suspense must not play loudly at the same time.

---

# 50. Audio Service

Preload suspense and effects.

Provide independent suspense and effects volumes.

Audio failure is recoverable and must not block gameplay.

---

# 51. Timer Service

Use wall-clock timing with start, pause, resume, restart, adjust, disable, stop, and dispose.

Expiration fires once.

---

# 52. Application Store

Suggested stores:

- game;
- catalog;
- Game Plans;
- Admin;
- settings.

Stores coordinate UI state but never implement rules.

---

# 53. Admin Write Architecture

```text
React Admin UI
  ↓
Local Node.js API
  ↓
JSON files
```

Validate, write to a temporary file, back up, atomically replace, and return validation results.

Game Mode remains usable without the Admin API.

---

# 54. Admin API Contract

Provide endpoints for health, songs, categories, Game Plans, validation, export, and import.

Deletion should retain backups or trash copies.

---

# 55. Import, Export, and Backup

Support exporting individual songs, selected songs, full catalog, Game Plans, and validation reports.

Use JSON initially and ZIP later if useful.

Create backups before bulk or destructive changes.

---

# 56. Error Model

Errors are categorized as Validation, Game Rule, Media, Audio, Timer, Persistence, Catalog, Admin API, or Unknown.

Severity is Info, Warning, Recoverable, or Fatal.

Every user-facing error explains what happened, whether the team is penalized, and what the host can do.

---

# 57. Error Recovery Workflows

- video before challenge: reroll without consuming turn;
- video during playback: retry, restart, reroll, manually continue, or cancel;
- suspense failure: continue;
- timer failure: continue manually;
- persistence failure: continue in memory and export;
- wrong score: reopen latest turn or adjust scoreboard.

---

# 58. Logging and Diagnostics

Log startup, validation, phase changes, challenge selection, player states, pause timing, timer actions, lifelines, scores, overrides, and persistence failures.

Do not log audio, secrets, or unnecessary personal information.

---

# 59. Security and Privacy

Keep team names and history local.

Validate all imported data and prevent path traversal.

Store only YouTube IDs and metadata; never download or proxy YouTube media.

---

# 60. UI Design Philosophy

The interface should feel like a TV game show, not a business dashboard.

Every gameplay moment should answer whose turn it is, what is happening, and what happens next.

---

# 61. Navigation and Global Layout

## 61.1 Screens

Pre-game:

- Home;
- Resume;
- Saved Game Plans;
- New Game;
- Party Check;
- Demo;
- Settings;
- Admin.

Gameplay:

- Level Intro;
- Trivia Result;
- Turn Announcement;
- Category Selection;
- Challenge Preview;
- Playback;
- Answer;
- Primary Result;
- Steal;
- Verification;
- Score Review;
- Turn Summary;
- Level Summary;
- Winner.

Admin:

- Dashboard;
- Songs;
- Song Editor;
- Challenge Editor;
- Categories;
- Coverage;
- Validation;
- Game Plans;
- Import/Export.

## 61.2 Gameplay Shell

```text
HEADER
MAIN GAMEPLAY STAGE
BOTTOM TEAM SCORE STRIP
COLLAPSIBLE HOST DRAWER
```

Do not show redundant Difficulty text or remaining-category count in the active challenge area.

Lifelines are contextual, not a large permanent section.

---

# 62. Gameplay Experience and Screen Flow

1. Level Introduction
2. Trivia Result
3. Turn Announcement
4. Category Selection
5. Challenge Selection transition
6. Challenge Preview
7. Song Playback
8. Challenge Pause
9. Primary Result
10. Steal Opportunity
11. Steal Attempt
12. Verification
13. Score Reveal
14. Turn Summary
15. Level Summary
16. Winner

Song and artist are revealed by default. Blind Challenge is configurable.

Transitions should be short, smooth, and skippable.

---

# 63. Admin Experience and Content Authoring

## 63.1 Admin Navigation

Dashboard, Songs, Categories, Coverage, Validation, Game Plans, Import/Export, Settings, and Back to Game.

## 63.2 Dashboard

Show totals, enabled content, errors, warnings, coverage gaps, and recent edits.

## 63.3 Song Library

Search, filter, sort, continuous scroll, and actions for edit, preview, duplicate, enable/disable, and delete.

## 63.4 Add Song

Paste URL, extract video ID, enter metadata, assign categories, add challenges, preview, enable.

## 63.5 Challenge Editor

Mark playback start, verify start, pause, and verify end from the player. Support manual timestamp entry and nudge controls.

## 63.6 Preview

Simulate the real challenge lifecycle and display actual pause deviation.

## 63.7 Coverage and Validation

Show category-level matrix and actionable errors/warnings.

## 63.8 Save Behavior

Use explicit Save and preserve unsaved drafts on failure.

---

# 64. Theme Architecture

Two themes ship in MVP:

```text
Day Party — default
Game Night — selectable
```

Themes share layout, components, spacing, and behavior. Only semantic tokens differ.

Persist the selected theme. A Saved Game Plan may store a preferred theme.

---

# 65. Reusable Components and Interaction Standards

Gameplay components include shell, header, score strip, team cards, timer, category grid, challenge preview, YouTube stage, answer prompt, lifeline buttons, steal prompt, result classification, verification controls, score breakdown, host drawer, and recovery panel.

Admin components include sidebar, search, filter bar, virtualized list, infinite-scroll sentinel, coverage grid, timestamp controls, validation cards, and unsaved-changes banner.

Use one primary action per screen where practical.

Confirm paid, destructive, or high-impact actions, not routine result classification.

---

# 66. Continuous Scrolling

Use continuous scrolling for songs, curated pools, validation issues, challenge candidates, and large history lists.

Recommended initial batch: 40. Additional batch: 30.

Use `IntersectionObserver`. Add virtualization if performance requires it.

Reset scroll and rendered count after search or filter changes.

---

# 67. Saved Game Plans

A Game Plan stores:

- name and description;
- ten categories;
- curated challenge pools by category and level;
- game configuration;
- preferred theme;
- song-reveal setting;
- validation status.

Support create, save, edit, duplicate, rename, delete, validate, and play.

Starting a game copies the plan into a new independent session.

---

# 68. Party Check and How to Play Demo

## 68.1 Party Check

Tests display, internet, YouTube, song audio, automatic pause, suspense, timer controls, verification, and Local Storage.

Does not affect real game state.

## 68.2 Quick Check

Tests YouTube, audio, pause, suspense, and verification in 30–60 seconds.

## 68.3 Demo

Demonstrates category strategy, preview, playback, pause, lifelines, Mostly Correct primary, Perfect steal, verification, and split score using isolated demo state.

---

# 69. Testing Strategy

Prioritize pure domain unit tests, then integration tests, component tests, Playwright E2E, real YouTube smoke tests, and party playtests.

Critical tests include category consumption, level progression, full score matrix, lifelines, timers, rerolls, curated pools, command idempotency, score idempotency, refresh recovery, theme persistence, Admin authoring, Game Plan reuse, Party Check isolation, and Demo isolation.

---

# 70. Performance and Compatibility

Targets:

```text
Shell visible within 2 seconds
Catalog ready within 3 seconds
Host feedback within 100 ms
Pause within approximately 250 ms
```

Support at least 1,000 songs and 5,000 challenges.

Primary browser: current Chrome. Smoke test Edge and Safari.

---

# 71. Development Standards

Use TypeScript strict mode where practical, ESLint, Prettier, explicit domain types, small pure functions, no silent errors, no game rules in UI, and no unresolved placeholders in completed milestones.

Definition of Done includes implementation, tests, type check, lint, error handling, theme check for UI changes, documentation, and demonstration.

---

# 72. Build, Deployment, and Release

Recommended commands:

```bash
npm install
npm run dev
npm run test
npm run lint
npm run typecheck
npm run build
npm run e2e
npm run dev:all
npm run start
```

CI runs type check, lint, tests, build, and a small E2E smoke suite.

Version milestones:

```text
0.1.0 playback spike
0.2.0 game engine
0.3.0 complete gameplay
0.4.0 Admin
0.5.0 party candidate
1.0.0 accepted MVP
```

---

# 73. Implementation Milestones

1. Foundation
2. Models and Schemas
3. Pure Game Engine
4. State Machine and Commands
5. Catalog, Round Builder, and Game Plans
6. YouTube Playback Spike
7. Timer and Audio
8. Minimal Full Gameplay
9. Persistence and Recovery
10. Saved Game Plans
11. Admin Authoring
12. Themes and UI System
13. Party Check and Demo
14. Presentation Polish
15. Release Candidate

Implement one milestone at a time with tests and an explicit stop before the next milestone.

---

# 74. MVP Risk Register

Key risks:

- YouTube availability;
- pause timing;
- host controls exposed to players;
- catalog coverage gaps;
- overbuilding;
- state complexity;
- session corruption;
- theme inconsistency;
- Admin scope growth;
- party environment issues.

Mitigation order:

```text
Prevent → Detect early → Recover safely → Allow host override
```

---

# 75. Traceability and Final Acceptance

Core ownership:

| Requirement | Owner |
|---|---|
| Two teams | Game Engine |
| Five levels | State Machine |
| Ten categories | Round Builder |
| No category reset | Category Rules |
| Trivia order | Level State |
| YouTube | Player Adapter |
| Automatic pause | Playback Coordinator |
| Suspense | Audio Service |
| Timers | Timer Service |
| Lifelines | Lifeline Service |
| Steals | State Machine and Scoring |
| Overrides | Host Override Model |
| Reroll | Challenge Selection |
| Persistence | Session Repository |
| Saved plans | Game Plan Repository |
| Party Check | Party Check Coordinator |
| Demo | Demo Coordinator |

The MVP is accepted when a complete five-level game can be played, recovered after refresh, use free and paid lifelines, complete a successful steal, reroll a song, override a score, switch themes, load a Saved Game Plan, pass Party Check, and run the Demo without critical failure.

---

# 76. Specification Freeze and Codex Handoff

Requirement hierarchy:

1. `01_Game_Design_Document.md`
2. `02_Engineering_Spec.md`
3. `03_Codex_Implementation_Guide.md`
4. Source code

Older chats, amendments, and mockups are non-authoritative after freeze.

Codex receives the frozen GDD, this Engineering Specification, the current milestone prompt, and relevant repository files.

For every milestone, Codex must inspect, plan, implement only the milestone, test, run checks, summarize, list limitations, and stop.

Codex must not invent gameplay rules, reset categories by level, disable lifelines permanently after the free use, auto-mark timer expiry Wrong, reveal lyrics before steal resolution, replace curated pools with exact scripting, place rules inside UI components, or skip tests.

---

# Final Engineering Recommendation

Start with the highest-risk technical proof:

```text
Load one YouTube video
→ start at configured timestamp
→ pause automatically
→ start suspense audio
→ run timer
→ replay verification
```

Then build pure rules, state machine, minimal full game, persistence, Saved Game Plans, Admin authoring, Party Check and Demo, and finally themes and polish.

The MVP succeeds when it produces one enjoyable, recoverable, full party game.

---

# End of Engineering Specification
