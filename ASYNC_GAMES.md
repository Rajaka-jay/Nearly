# Nearly asynchronous games

Open **Play → Async** and choose **Four in a Row**, **Reversi**, or **Pebble Paths**. Both accounts must be connected to the same space. Either partner can close the game and return later; each accepted move is stored in PostgreSQL. Boards refresh every four seconds while the page is visible, with immediate refresh on returning to the tab or coming back online. Refresh board is also available. There are no turn timers or requirements to be online together.

Four in a Row uses a 7 × 6 gravity board and checks horizontal, vertical, and both diagonal wins and a full-board draw. Reversi uses an 8 × 8 board, server-derived legal moves, capture in eight directions, automatic passes, and final disc scoring. Pebble Paths uses normal-play Nim: take a positive number from one pile, and the final pebble wins. A finished board remains visible. Both partners must agree to a new round; the starter alternates each round.

## Deployment and authorization

Apply `supabase/async_games.sql` once before deploying the frontend. The migration adds two new tables and the authenticated `nearly_async` RPC, without modifying existing games or shared space data. No frontend environment variables or dependencies are added.

The RPC intentionally runs as SECURITY DEFINER with an empty search path. It obtains the user from `auth.uid()`, locks and derives the current couple space, and matches both membership snapshots. It never accepts a client-supplied space, user, seat, board, or result. Every move requires the current board version and a request UUID. Row locks serialize concurrent requests, and receipts make retries idempotent, including forced passes and rematch acceptance. Table privileges are revoked from PUBLIC, anon, and authenticated; RLS is enabled as defense in depth. The absence of table policies is intentional because clients use only the RPC. Security advisors may flag the intentionally authenticated SECURITY DEFINER API; authorization is verified in the integration tests.

The membership snapshot prevents a replacement partner from seeing games played by a prior couple. Leaving/unpairing immediately blocks the old member's RPC access. Signing out clears the open game screen. Game data is not copied to localStorage. The new games use bounded polling rather than a Realtime publication, so browser suspension cannot drop the only copy of a move. The client displays network, permission, invalid move, and stale-version errors; it never silently falls back to an unsynchronized local board.

## Verification

`npm run check` checks every root JavaScript file. `npm test` includes `tests/async-games.mjs`, running the actual migration and RPC against PGlite PostgreSQL. It tests all games, independent full-game Reversi simulation, forced passes, draw and win cases, illegal moves, duplicate requests, stale versions, mutual rematches, alternating starts, anonymous/direct-table denial, outsider isolation, unpairing, and replacement-partner separation. Existing chat, calls, and sync suites run as regressions.

Automated and browser checks reduce risk; they do not guarantee software is free of bugs. A real two-device account test remains useful after release, especially with an interrupted mobile connection. No account credentials or private production board contents belong in this document or test fixtures.
