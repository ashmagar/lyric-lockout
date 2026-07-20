# Application UX Specification (UI V1)

Last updated: July 20, 2026

## Application Structure

HOME - Resume Game - New Game - Saved Game Plans - Admin Portal -
Settings

GAMEPLAY - New Game - Backstage - Category Selection - Challenge -
Scoreboard - Winner

ADMIN PORTAL - Dashboard - Song Library - Challenge Editor - Category
Editor - Coverage - Validation - Import - Export / Backup

Opening Trivia was intentionally removed. The host decides how to choose
the first team.

## Application Shells

### Standard Shell

Used on Home, New Game, Saved Game Plans, setup, Admin Portal, and
Settings.

-   Lyric Lockout branding remains visible at the top left.
-   Interior pages use the shared navigation sidebar, header, main
    workspace, and footer.
-   The shell remains stable while the screen context changes.

### Live-Game Shell

Used once active gameplay begins.

-   The main gameplay workspace uses the full available width.
-   Lyric Lockout branding remains visible in the top-left action bar.
-   Level and phase context appear beside the brand.
-   New Game and Finish Game remain available at the top right.
-   Teams, scores, lifelines, category context, and progress appear in a
    compact bottom status rail.
-   Host controls appear in the right-side challenge panel when relevant.
-   Do not add a duplicate score strip, bottom host-control drawer, or
    second control surface.

## Screen Summary

### Home

Purpose: Main navigation. Displays Resume Game (if present), New Game,
Saved Game Plans, Admin Portal, Settings.

-   Uses the stacked Lyric / Lockout wordmark.
-   The second O in Lockout is represented by the shared lock icon.
-   Uses compact action cards and the approved neon stage background.

### New Game

Choose Saved Game Plan, Custom Game, or Random Game.

### Saved Game Plans

Searchable, scrollable list with create/edit/delete/duplicate.

### Custom Categories

Dual-list selector. Exactly 10 categories required before Continue.

### Backstage

Review teams, lifelines, rules summary and category preview. No trivia,
no estimated duration.

### Category Selection

Current team chooses a category. Completed categories are disabled.

### Challenge

Video flips into lyric challenge. Host controls and timer visible.

-   Preserve the YouTube player at 16:9.
-   Give the player priority over decorative space.
-   Playback controls remain visible in the right-side host panel.
-   Answer screens use large readable lyrics and controls.

### Scoreboard

Overlay on blurred challenge screen. Animate score changes
independently.

### Winner

Winning team, trophy, confetti. Play Again, New Game, Home.

The host can finish the game at any active gameplay phase. The game also
finishes automatically when no eligible category or challenge remains.
Final scores always reflect points confirmed before completion.

### Admin Portal

Manage songs, challenges, categories, imports, backups and tools. Uses
the same application shell.

The current Admin Portal is approved for UI V1. Further structural
redesign is deferred unless explicitly requested. A dedicated Database
Tools section is not part of the current UI V1 implementation.

### Settings

Manage theme, motion, game-audio preferences, local device status, and
default rule references. YouTube playback volume remains controlled by
the embedded player.
