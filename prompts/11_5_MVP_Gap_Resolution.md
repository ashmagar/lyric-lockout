# Lyric Lockout — Milestone 11.5: MVP Gap Resolution

## Objective

Review the existing Lyric Lockout repository and implement the confirmed MVP gaps listed below.

The application has already been manually played through. The overall architecture and main gameplay flow are working. Do not redesign the application or broadly refactor unrelated areas.

This task is a focused alignment pass covering:

1. Category management
2. Consumed-category presentation
3. Partial lyric / hidden-word challenges
4. Challenge authoring preview productivity

A fifth issue involving pausing and resuming the full game is explicitly deferred and must not be implemented as part of this task unless a tiny, isolated fix is required to prevent regressions.

---

# Source of Truth

Before making changes, read the relevant project documents, especially:

- `docs/01_Game_Design_Document.md`
- `docs/02_Engineering_Spec.md`
- `docs/03_Codex_Implementation_Guide.md`
- Any existing schemas, domain models, repositories, state-machine documentation, or admin documentation in the repository

Treat this prompt as an MVP requirement clarification where it is more specific than the earlier documents.

Do not silently reinterpret the requirements.

---

# Required Workflow

## Step 1 — Inspect First

Before modifying code:

1. Inspect the current repository structure.
2. Identify:
   - category domain model and repository
   - admin category UI
   - game-plan category references
   - game session category state
   - challenge schema and editor
   - gameplay challenge rendering
   - YouTube/player adapter
   - preview/test controls
   - persistence and migration behavior
3. Run the existing test suite and record the baseline.
4. Provide a concise implementation plan grouped by requirement.
5. Identify any data migration or backward-compatibility concerns.

Do not begin with a large architectural rewrite.

## Step 2 — Implement Incrementally

Implement one requirement at a time.

After each requirement:

- add or update automated tests
- run relevant tests
- verify existing behavior remains intact

## Step 3 — Final Validation

At completion:

- run the full test suite
- run linting
- run TypeScript checks
- run production build
- summarize all changed files
- document manual verification steps
- call out any unresolved limitations honestly

---

# Requirement 1 — Category CRUD

## Priority

P0 — required before catalog expansion.

## Current Behavior

Existing categories cannot be created or edited from the Admin interface.

## Required Behavior

The Admin interface must allow the host to:

- create a category
- edit an existing category
- save category changes
- cancel an edit without changing data
- see validation errors before invalid data is saved

Deletion may be implemented only if it is already compatible with the repository architecture and can be handled safely. Do not introduce unsafe deletion merely to complete CRUD terminology.

## Category Fields

Use the existing category model where possible.

At minimum, support editing the fields already used by the application, such as:

- stable ID
- display name
- icon or emoji, if supported
- description, if supported
- presentation metadata or theme accent, if currently part of the model
- enabled/disabled status, if currently supported

Do not add speculative fields that the application does not use.

## Stable Identity

Category display names may change without breaking references.

Game Plans, challenges, saved sessions, or other entities must reference categories through stable IDs rather than display names.

If the application currently uses category names as identifiers, refactor only the minimum necessary to introduce stable IDs safely.

## ID Rules

For a new category:

- generate a stable unique ID
- do not regenerate the ID when the display name changes
- prevent duplicate IDs
- category names may be validated for uniqueness if that matches the current product behavior

## Validation

At minimum:

- display name cannot be blank
- ID cannot be blank
- ID must be unique
- whitespace-only values are invalid
- invalid records must not be persisted

## Referential Safety

Before editing or deleting categories, inspect how they are referenced.

Editing the category name must not break:

- songs
- challenges
- Game Plans
- active or saved game sessions

If deletion is supported:

- prevent deletion when referenced, or
- require explicit reassignment/removal from dependent objects

Do not cascade-delete challenges or Game Plans silently.

## Persistence

Changes must persist using the existing repository abstraction and storage mechanism.

Do not bypass repositories by writing directly from React components.

## Acceptance Criteria

- A host can create a category in Admin.
- The new category appears after saving.
- The category survives reload or repository reload.
- A host can edit the category display name.
- Its stable ID remains unchanged.
- Existing references continue to resolve.
- Invalid categories cannot be saved.
- Cancel leaves the original data unchanged.
- Automated tests cover creation, editing, validation, persistence, and reference safety.

---

# Requirement 2 — Consumed Categories Remain Visible

## Priority

P1 — core gameplay behavior.

## Current Behavior

When a category is consumed, it is removed from the category list.

## Required Behavior

All categories selected for the game must remain visible for the entire game.

A consumed category must:

- remain in its original logical position
- be visibly marked as consumed
- be disabled
- be impossible to select again
- remain readable enough that players can remember what was used
- preferably show which team consumed it

Do not remove consumed categories from the collection used for rendering.

## Visual States

Every category needs an explicit presentation state:

1. Available
2. Current or selected
3. Consumed by Team A
4. Consumed by Team B
5. Disabled for another valid reason, if supported

Consumed-category styling should include:

- reduced visual prominence or grayscale treatment
- disabled interaction
- a checkmark or “Used” marker
- consuming team indicator

The final visual design will be polished later, but the information architecture and state behavior must be correct now.

## Team Attribution

Persist or derive which team consumed each category.

Preferred conceptual domain representation:

```ts
type CategoryConsumption = {
  categoryId: string;
  consumedByTeamId: string;
  consumedAtTurn?: number;
};
```

Use the project's existing domain conventions rather than copying this exact shape blindly.

Do not infer the consuming team from current turn state after the fact if that information can become ambiguous.

## State-Machine Behavior

Category consumption should happen only at the correct committed gameplay transition.

Review existing behavior so that a category is not marked consumed:

- merely by hovering
- during preview
- before the host confirms the turn
- because of a temporary UI selection
- during a reroll that preserves the same category

A reroll must not consume another category.

## Persistence and Recovery

Consumed state and team attribution must survive:

- reload
- session recovery
- navigation away and back
- saved active-game restoration

## Accessibility

Consumed categories must be semantically disabled.

Do not rely only on color.

Use text, icons, state labels, `disabled`, or appropriate ARIA attributes.

## Acceptance Criteria

- The game starts with all configured categories visible.
- Selecting and committing a category marks it consumed.
- The category remains visible.
- The consuming team is identifiable.
- The category cannot be selected again.
- Other available categories remain selectable.
- Reroll does not consume another category.
- State persists after reload.
- Automated tests cover domain state, UI state, disabled interaction, attribution, and restoration.

---

# Requirement 3 — Partial Lyrics and Hidden Words

## Priority

Treat as P1 for implementation because it defines the core challenge experience, even though it was originally logged as P2.

## Current Behavior

The gameplay screen only shows a generic “Complete the song” message.

## Required Behavior

Each challenge must define a sequence of acceptable lyric words and indicate which words are hidden.

During gameplay:

- visible words are displayed normally
- hidden words are displayed as blanks
- hidden words do not have to be contiguous
- all words may be hidden
- the order and punctuation of the configured lyric presentation should remain understandable
- the host can reveal or verify the complete acceptable lyrics through the existing verification flow

Example configured lyrics:

```text
Maybe this time I'll be lucky
```

Example hidden indexes:

```text
1, 2, 5
```

Possible rendered challenge:

```text
Maybe ____ ____ I'll be ____
```

The exact indexing convention must be explicit and consistent. Prefer zero-based indexes internally if that matches the TypeScript codebase, but the Admin UI must make selection understandable without requiring the host to think in indexes.

## Important Semantic Clarification

A challenge contains an **acceptable lyric answer** comprising a defined ordered sequence of words.

Hidden words may be any subset of those words.

For example, a 15-word acceptable answer could hide words:

- 2
- 3
- 7
- 9
- 15

The missing words are not required to be one continuous segment.

If all 11 words are hidden, display 11 individual blanks rather than one generic blank area.

## Data Model

Extend or refine the challenge model to represent:

- full acceptable lyric text or structured lyric tokens
- hidden-word selection
- optionally preserved display punctuation
- challenge timing fields already present

A suitable conceptual representation is:

```ts
type LyricToken = {
  text: string;
  hidden: boolean;
};

type ChallengeLyrics = {
  tokens: LyricToken[];
};
```

Alternative representation:

```ts
type ChallengeLyrics = {
  acceptableLyrics: string;
  hiddenWordIndexes: number[];
};
```

Choose the representation that best fits the existing application.

### Selection Guidance

Use token objects if:

- punctuation preservation matters
- the editor needs direct per-word toggling
- the renderer benefits from structured tokens

Use full text plus hidden indexes if:

- the application already stores full strings
- reliable tokenization and migration are straightforward

Do not store only a pre-rendered string containing underscores. The data model must preserve the complete answer independently from presentation.

## Tokenization and Punctuation

Define one deterministic tokenization strategy.

Requirements:

- punctuation should not become a “missing word” by itself
- apostrophes inside words should remain part of the word when practical
- repeated words must be individually selectable
- display order must remain stable
- editing the acceptable lyrics must not silently map old hidden indexes to the wrong words

When acceptable lyrics change, either:

- safely reconcile the selection, or
- clear/review hidden selections and visibly notify the author

Do not silently preserve invalid hidden indexes.

## Challenge Editor

The challenge editor must allow the host to:

1. Enter or edit acceptable lyrics.
2. See the lyrics separated into selectable word tokens.
3. Toggle any individual word between visible and hidden.
4. Select all words.
5. Clear all hidden selections.
6. See the number of hidden words.
7. Preview exactly how the challenge will appear.
8. Save the challenge.
9. Reopen it later and edit the hidden-word selection.

Recommended interaction:

- display each word as a selectable chip/token
- selected tokens represent hidden words
- punctuation remains visually associated with its word
- do not require manual entry of numeric indexes

## Validation

At minimum:

- acceptable lyrics cannot be empty
- challenge must contain at least one word
- at least one hidden word should normally be required

If zero hidden words has a legitimate existing use, allow it only with a warning or explicit confirmation. Otherwise reject it.

Also validate:

- indexes or token selections are within range
- no duplicate indexes
- saved structure matches the rendered preview
- malformed legacy records produce a clear validation error

Do not impose arbitrary rules such as “easy challenges cannot hide all words” unless already documented as a game rule. Such balancing decisions should remain host-controlled for MVP.

## Gameplay Rendering

During the challenge-answer state:

- render the full token sequence
- show visible words
- replace each hidden word with an individual blank
- preserve wrapping responsively
- make blanks sufficiently wide to communicate one missing word without revealing the exact word
- do not reveal hidden-word length through underscore count unless that is explicitly desired

A hidden word should render conceptually as:

```text
____
```

not as one underscore per letter.

## All-Words-Hidden Case

For 11 hidden words, render 11 separate blanks.

Do not fall back to only:

```text
Continue the lyrics...
```

The generic instruction may remain as a heading, but the blank sequence must be the primary challenge content.

## Reveal and Verification

When the host reveals/verifies the answer:

- display the complete acceptable lyrics
- distinguish formerly hidden words if useful
- do not alter scoring automatically
- preserve host authority

An animation is optional and should not block this implementation.

## Backward Compatibility

Inspect the existing challenge catalog.

Provide a safe handling strategy for legacy challenges that lack hidden-word configuration.

Preferred options in order:

1. Migration with an explicit default.
2. Admin warning requiring author review.
3. Temporary fallback in gameplay.

Do not silently reinterpret every legacy challenge in a way that could produce incorrect puzzles.

A reasonable fallback might treat all words as hidden, but use this only if it matches the intended older “continue the lyrics” behavior and document the decision.

## Acceptance Criteria

- The editor accepts full acceptable lyrics.
- Every word can be independently toggled hidden/visible.
- Non-contiguous hidden words work.
- Repeated words can be selected independently.
- All words can be hidden.
- Preview matches gameplay rendering.
- Saved challenges reopen with the same selection.
- During gameplay, visible words and individual blanks render correctly.
- Reveal shows the complete answer.
- Invalid hidden indexes cannot be saved.
- Legacy data is handled intentionally.
- Automated tests cover tokenization, editing, validation, persistence, rendering, all-hidden, partial-hidden, punctuation, repeated words, and migration/fallback behavior.

---

# Requirement 4 — Jump to Challenge Preview

## Priority

P1 — essential authoring productivity feature.

## Current Behavior

When testing a challenge, the author must play the video from the normal playback start and wait until the pause timestamp.

## Required Behavior

The challenge editor must provide a control labeled clearly, such as:

```text
Play from 5 seconds before challenge
```

or:

```text
Jump to Challenge (-5s)
```

When activated:

1. Calculate the target seek time.
2. Seek the YouTube player to five seconds before the configured challenge pause timestamp.
3. If the pause timestamp is less than five seconds, seek to zero.
4. Begin playback.
5. Use the normal challenge pause behavior at the configured pause timestamp.
6. Allow the author to verify whether the pause occurs correctly.
7. Keep the preview isolated from any real game session.

## Time Calculation

Conceptually:

```ts
previewStartSeconds = Math.max(0, challengePauseSeconds - 5);
```

Use the project's existing timestamp representation and utilities.

Do not duplicate timing logic in React if an application service or player adapter already owns it.

## Player Readiness

The control should handle cases where:

- the player has not loaded yet
- the video ID is invalid
- the pause timestamp is missing
- the pause timestamp is beyond video duration
- seek fails
- autoplay is blocked

Show a useful error or status rather than failing silently.

## Preview State

While previewing, display useful feedback such as:

- queued
- seeking
- playing preview
- paused at challenge
- error

Do not persist preview playback state as game state.

## Existing Controls

Preserve existing preview controls where useful.

The author should still be able to:

- play from normal start
- pause manually
- replay
- test challenge pause
- edit timestamps

The new jump control supplements rather than removes existing preview functionality.

## Timing Accuracy

The test must invoke the same pause/coordinator logic used during real gameplay where practical.

Do not create a separate fake pause implementation that can behave differently from the game.

Allow normal YouTube timing tolerance, but test the internal scheduling and state transitions deterministically where possible.

## Acceptance Criteria

- A configured challenge with pause at 65 seconds can preview from approximately 60 seconds.
- A challenge at 3 seconds previews from zero.
- Playback automatically pauses at the configured challenge point.
- The author does not need to wait through the full song.
- Invalid or unloaded videos produce visible errors.
- Preview does not mutate active game state.
- Automated tests cover target calculation, boundary conditions, command invocation, pause coordination, and errors.

---

# Deferred Requirement — Pause and Resume Entire Game

## Logged Behavior

The host’s “pause the game safely” behavior should eventually pause the video as well. Currently, after resuming and selecting “Play Challenge,” playback may restart from the beginning.

## Decision

Deferred.

Do not implement a broad game pause/resume redesign in this task.

However:

- ensure the new preview feature does not worsen this behavior
- do not delete or invalidate existing resume state
- mention any obvious isolated defect discovered during implementation
- create or preserve a backlog item with the expected and current behavior

Only fix it now if the change is extremely localized, low-risk, and necessary for one of the four required features. Otherwise leave it deferred.

---

# Cross-Cutting Requirements

## Preserve Existing Architecture

- Keep domain rules out of React components.
- Use existing repositories.
- Use existing application services and commands.
- Keep YouTube calls behind the player adapter.
- Preserve the state machine.
- Avoid global mutable state.
- Avoid duplicating selection or timing logic.

## Data Migration

Because challenge data may change, explicitly inspect persistence.

If migration is necessary:

- version the stored schema
- make migration deterministic
- preserve original data where possible
- test migration
- fail with actionable errors rather than corrupting the catalog

For local JSON-backed records, update example/seed data as needed.

## Existing Content

Do not require the host to recreate all existing songs manually unless technically unavoidable.

Support existing records through migration, fallback, or a clearly marked “needs review” state.

## Testing Expectations

Add or update tests at the correct layers.

### Domain / Unit Tests

Cover:

- category identity and validation
- category consumption and team attribution
- lyric tokenization
- hidden-word validation
- partial and complete hiding
- preview start calculation
- migration logic

### Application Tests

Cover:

- category creation/edit commands
- consumption transition
- session persistence
- challenge save/edit flow
- preview command and player interaction

### Component Tests

Cover:

- Admin category form
- consumed category display
- disabled category interaction
- lyric token selector
- challenge rendering
- all-hidden rendering
- jump-to-challenge control
- error/status feedback

### Integration or E2E Tests

At minimum, automate these flows if the repository already has an E2E framework:

1. Create and edit a category.
2. Use a category in a game and confirm it remains visible and disabled.
3. Create a challenge with non-contiguous hidden words.
4. Reopen the challenge and verify the selections.
5. Play the challenge and verify blanks.
6. Reveal the full lyrics.
7. Trigger jump-to-challenge preview and verify seek/pause behavior.

Do not introduce an entirely new heavy E2E framework if none exists; use the current testing stack.

---

# Manual Verification Checklist

After implementation, manually verify:

## Category Admin

- [ ] Create a category.
- [ ] Edit its name.
- [ ] Reload and confirm persistence.
- [ ] Confirm the ID did not change.
- [ ] Confirm existing references still work.
- [ ] Try invalid and duplicate values.

## Consumed Categories

- [ ] Start a game with all categories visible.
- [ ] Consume one with Team A.
- [ ] Confirm it remains visible.
- [ ] Confirm Team A attribution.
- [ ] Confirm it cannot be selected again.
- [ ] Reload and confirm restoration.
- [ ] Reroll and confirm no additional category is consumed.

## Partial Lyrics

- [ ] Create a 15-word challenge.
- [ ] Hide words 2, 3, 7, 9, and 15.
- [ ] Save and reopen it.
- [ ] Confirm the same words remain hidden.
- [ ] Preview the puzzle.
- [ ] Run it in gameplay.
- [ ] Confirm visible words and five individual blanks.
- [ ] Reveal and confirm all 15 words.
- [ ] Test an all-hidden 11-word challenge.
- [ ] Test repeated words and punctuation.

## Jump to Challenge

- [ ] Set a pause time beyond five seconds.
- [ ] Jump to five seconds before it.
- [ ] Confirm playback starts at the expected point.
- [ ] Confirm it pauses at the challenge timestamp.
- [ ] Test a pause timestamp under five seconds.
- [ ] Test missing and invalid timestamp/video states.
- [ ] Confirm no active game state is modified.

---

# Deliverables

At completion, provide:

1. Implementation summary by requirement.
2. List of changed files.
3. Domain-model or schema changes.
4. Migration/backward-compatibility strategy.
5. Tests added or changed.
6. Full verification results:
   - tests
   - lint
   - typecheck
   - build
7. Manual test instructions.
8. Any deferred or unresolved issues.
9. Screenshots or concise descriptions of the updated Admin and gameplay states, where the environment supports them.

---

# Definition of Done

This task is complete only when:

- category creation and editing work reliably
- consumed categories remain visible and disabled
- consuming team attribution is shown
- partial and all-hidden lyric challenges can be authored
- non-contiguous words can be hidden
- gameplay renders configured words and blanks
- full acceptable lyrics can be revealed
- authors can jump to five seconds before the challenge timestamp
- existing data is handled safely
- repository boundaries remain intact
- tests pass
- typecheck passes
- lint passes
- production build passes
- the deferred pause/resume issue has not been accidentally pulled into scope
