# Lyric Lockout
# Game Design Document (GDD)

**Version:** 1.0 (Frozen MVP)

## 1. Vision

Lyric Lockout is a party game where **lyric memory** is the skill being tested.

The game is intentionally **not** about singing ability or musical talent.

Players succeed by remembering the missing lyrics after the music pauses.

The game is designed for family gatherings and parties using existing YouTube lyric or karaoke videos.

---

# 2. Core Design Pillars

- Lyrics over singing ability.
- Easy to host.
- High replay value.
- Strategy through category selection.
- Friendly competition.
- Host remains final authority.
- Minimal setup before a party.

---

# 3. Target Audience

- Families
- Friends
- House parties
- Office parties
- Bollywood, Hollywood or themed music nights

---

# 4. Gameplay Overview

Two teams compete over five levels.

Each level has increasing difficulty.

There are ten categories available for the entire game.

Categories are consumed permanently once chosen.

Each level:

1. Host asks a trivia question.
2. Trivia winner decides who plays first.
3. First-playing team chooses (or is assigned) a category.
4. Song challenge is played.
5. Second team plays using another remaining category.
6. Continue until all ten categories are consumed.

---

# 5. Levels

| Level | Timer | Full Points |
|---|---:|---:|
|1|30 sec|100|
|2|45 sec|200|
|3|60 sec|300|
|4|90 sec|400|
|5|120 sec|500|

Difficulty increases by:

- deeper lyrics
- more missing words
- longer missing section

---

# 6. Categories

Exactly ten categories are used per game.

Examples:

- 90s Bollywood
- Romantic
- Party Songs
- Female Vocals
- Sad Songs
- Dance Hits
- Classic Rock
- Disney
- Tamil
- Marathi

Categories never reset during the game.

---

# 7. Challenge Flow

1. Category selected.
2. Challenge selected.
3. Preview:
   - Song
   - Artist (configurable)
   - Level
   - Missing words
4. YouTube plays.
5. Video pauses automatically.
6. Suspense music starts.
7. Team continues lyrics.
8. Host classifies answer.
9. Steal if eligible.
10. Verification replay.
11. Score review.
12. Next turn.

---

# 8. Scoring

| Primary | Steal | Primary | Steal |
|---|---|---:|---:|
|Perfect|-|Full|0|
|Mostly Correct|Perfect|Half|Half|
|Mostly Correct|Other|Half|0|
|Wrong|Perfect|0|Half|
|Wrong|Other|0|0|

Host may override any score.

---

# 9. Lifelines

Each team receives:

- 1 free Hint
- 1 free Ask a Friend

After that:

Unlimited additional uses

Penalty:

-25 points per use

---

# 10. Host Controls

Host can:

- pause timer
- resume timer
- restart timer
- extend timer
- shorten timer
- disable timer
- reroll song
- override scores
- override classifications
- resolve disputes

Host decisions are final.

---

# 11. Saved Game Plans

Hosts may prepare multiple party sessions in advance.

Each Game Plan stores:

- categories
- curated challenge pools
- theme
- reveal song option
- gameplay settings

Starting a game copies the plan into a new session.

---

# 12. Party Check

Before guests arrive:

- internet
- YouTube
- TV audio
- pause timing
- suspense music
- timer
- verification replay
- persistence

---

# 13. How to Play Demo

Interactive demo explaining:

- rules
- category strategy
- pause mechanic
- lifelines
- steals
- verification
- scoring

Does not modify real game state.

---

# 14. Themes

Default:

Day Party

Optional:

Game Night

Both themes use identical layouts.

---

# 15. Admin Features

- Add songs
- Edit songs
- Add challenges
- Timestamp editor
- Preview challenge
- Validation
- Coverage dashboard
- Saved Game Plans
- Import/export

---

# 16. MVP Scope

Included:

- Complete two-team gameplay
- Five levels
- Ten categories
- YouTube playback
- Automatic pause
- Suspense music
- Timers
- Lifelines
- Steals
- Host overrides
- Saved Game Plans
- Party Check
- Demo
- Admin tools

Deferred:

- AI judging
- Voice recognition
- Recording
- Mobile controllers
- Online multiplayer
- Statistics
- Cloud sync
- Monetization

---

# 17. Product Roadmap

Version 1.0
- Complete local MVP

Version 1.1
- UX improvements
- Better animations
- More admin tools

Version 2.0
- Mobile host controller
- Voice recording
- AI lyric checking
- Tournament mode

---

# 18. Product Success

The MVP succeeds when:

- Players immediately understand the game.
- A full five-level game completes without restart.
- Hosts can prepare games before a party.
- Friends ask to play another round.

---

# 19. Frozen Rules

Authoritative rules:

- Two teams
- Five levels
- Ten categories
- Categories consumed permanently
- One free Hint
- One free Ask a Friend
- Unlimited paid lifelines (-25)
- Perfect blocks steal
- Mostly Correct and Wrong allow steal
- Only Perfect steal scores
- Host authority always wins
- Pause-based challenge
- Day Party default theme
- Continuous scrolling
- Saved Game Plans
- Party Check
- Demo mode

This document defines WHAT the game is.

Engineering details belong only in the Engineering Specification.
