# Rebuild deployment status

## Implemented in this milestone

- A newly illustrated home with dual clocks, direct memory/mail/garden/game/reunion hotspots, restrained cream and lavender surfaces, a single icon system, and responsive navigation.
- Explicit sign-in and sign-up modes, inline auth feedback, recovery links, confirmation resend, pending-action protection, and a password-recovery form.
- A single save queue with three-way merging of independent edits, record-ID merging, revision conflict retries, and draft export when an edit cannot safely merge.
- An additive PostgreSQL migration with separate game-session rows, authenticated membership checks, version checks, duplicate-request receipts, turn enforcement, legal cell/card checks, win detection, completed-game locks, and server-hidden Memory Match cards.
- A game adapter that uses the new Tic Tac Toe and Memory Match server API when installed. Existing beta games remain available if the API is absent.
- Regression checks and a GitHub quality workflow.

## Verification performed locally

JavaScript syntax checks passed. Five sync regression tests passed. The SQL setup and additive migration were applied to a local embedded PostgreSQL engine with a test auth schema. Checks passed for win detection, out-of-turn rejection, stale-version rejection, duplicate action replay, finished-game rejection, third-account rejection, matching cards, hidden-card response masking, and direct-table access denial.

The local preview was blocked by the browser environment. After publication, the deployed desktop home and sign-in dialog were opened and visually inspected successfully. Mobile and real Supabase two-account verification remain pending. Password recovery and confirmation delivery need validation in the actual project.

## Required Supabase action

Run `supabase/migrations/20261118_game_sessions.sql` once through your project's SQL Editor. Do not re-run the original setup file on an existing database. This migration adds game tables/functions and preserves existing space data. The supplied publishable key cannot apply migrations.

After applying it, open Tic Tac Toe or Memory Match from both paired accounts. The server API will be selected automatically. Verify turns, refresh/resume, and simultaneous actions on separate devices.

## Remaining production work

The new authoritative backend covers Tic Tac Toe and Memory Match. Chess, drawing, question decks and the other activity boards still use the beta shared-document implementation. Closed-app Web Push, server-locked letters, authored normalized messaging, private object storage, complete account lifecycle, and the remaining release gates are tracked in PRODUCTION_PLAN.md. This milestone is a beta release and does not certify the whole application as production ready.

## Artwork

The home illustration was generated for this project with the built-in image-generation tool, then optimized as `assets/shared-sky.webp`. The prompt requested a wide painterly twilight valley with two warmly lit cottages joined by a garden path, lavender aurora and mountains, flowers and a mailbox, with no people, words or UI. It replaces the previous CSS house shapes.
