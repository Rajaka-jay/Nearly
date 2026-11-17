# Nearly production release plan

## Product target

A private responsive space where two independently authenticated adults can reliably message, save memories, make plans, and play together from separate devices. The uploaded design is the visual reference. Shared data must survive retries, refreshes, simultaneous actions, and temporary disconnections.

## Release status

The deployed site is an early beta. A production label requires the acceptance checks below to pass against a staging Supabase project and two independent browser sessions. A third account must be unable to read or mutate the space. Existing user data must be preserved.

## Delivery sequence

| Milestone | Deliverables | Completion condition |
| --- | --- | --- |
| 1. Design foundation | Detailed illustrated home, compact dual clocks above the world, consistent Lucide icons, serif heading hierarchy, cream surfaces, lavender actions, accessible responsive navigation, readable forms, loading/error/empty states | Desktop and mobile visual review, keyboard navigation, readable contrast and no horizontal overflow |
| 2. Account reliability | Explicit sign-in/sign-up modes, visible inline errors, loading protection, confirmation resend, session expiry handling, password recovery, pairing guidance | Two users register, confirm, recover access, pair once, sign out, and return |
| 3. Shared data integrity | One serialized write queue, explicit conflict handling, draft preservation, retry indicators, server-authorized atomic operations, data migration | Concurrent distinct edits survive, stale edits produce actionable conflicts, failed saves never report success |
| 4. Game engine | Server-enforced turn ownership, version checks, idempotent actions, persistent sessions, reconnect and resume, opponent invitations | Same final state on both devices after duplicate/out-of-order moves and reconnect |
| 5. Game catalog | Tic Tac Toe, Memory Match, chess, Draw & Guess, Guess My Answer, Would You Rather, Two Truths, date roulette, co-study | Each has instructions, invitation/start, playable session, results, replay, and optional memory saving |
| 6. Everyday connection | Authored messages and reactions, individual daily answers, letters, private media uploads, memory timeline, plans and wishes | Contributions retain author, image permissions enforce membership, scheduled content is locked server-side |
| 7. Notifications | Persistent in-app inbox, unread counts, preference controls, consent-based Web Push, quiet hours, delivery jobs and retry policy | Partner receives a notification with app closed, quiet hours work in recipient zone, revoked subscription is handled |
| 8. Release readiness | Security and accessibility review, storage limits, backups, monitoring, CSP, pinned dependencies, schema migrations, CI checks and deployment runbook | Critical regression suite passes in staging and deployed artifacts match the verified commit |

## Architecture decisions

- Keep Supabase Auth and PostgreSQL. Use authenticated RPCs and row-level access controls for private operations.
- Preserve the current records while introducing normalized records for profiles, memberships, messages, game sessions, game actions, notifications, media references, and preferences.
- Use transactional server mutations for game actions. Client rule validation improves feedback but never grants authorization.
- Use Supabase Realtime for invalidation and refresh authoritative snapshots after reconnect. Retain polling as a visible fallback.
- Use chess.js with its BSD notice for chess move validation. A server runtime supporting the same library is required before claiming authoritative chess validation.
- Store image/audio bytes in private object storage with signed access, rather than in the shared JSON document.
- Use a service worker, VAPID credentials, subscription storage and a background sender for closed-app push. Credentials stay in backend secrets.
- Watch nights coordinate a start clock and external viewing links. Embedded service playback requires that provider's supported API and user access.

## Work started in this update

- Replace the home composition and house placeholders with an illustrated world and individually operable hotspots.
- Introduce a consistent icon system and responsive layout matched to the reference's information hierarchy.
- Replace brittle auth feedback with explicit forms, visible errors and disabled pending actions.
- Centralize shared room refresh and protect active input and drawing from disruptive rerenders.
- Document the backend deployment boundary and remaining production gates honestly.

## Required verification before production

1. Sign-in failures, unconfirmed email, expired session, password recovery and resend throttling.
2. Pair invite expired/consumed/unrelated-user cases, concurrent pairing attempts and leaving the space.
3. Simultaneous chat/game/profile updates with disconnected/reconnected clients.
4. Duplicate move retry, out-of-turn move rejection, finished-game rejection and resume after refresh.
5. Chess castling, en passant, promotion, checkmate and draw history.
6. Notifications with page visible, hidden, closed, permission denied and subscription revoked.
7. Private uploads, type/size limits, inaccessible media after unpair, own-contribution deletion and export.
8. Mobile viewport, screen-reader names, focus return, keyboard-only flows and reduced motion.

## Environment boundary

GitHub repository writes are available. The supplied Supabase publishable key supports ordinary app access only. Schema migrations, function deployment, background scheduling, storage policy setup and server secrets require a Supabase management connection or the owner's dashboard. Never ask for database passwords or service-role keys in chat. Prepared code can be committed while those deployment steps remain pending.

## Deployment and rollback

Each change must carry a commit and a matching Pages deployment. Keep additive migrations separate from frontend publication and preserve migration history. Roll back a frontend by reverting its commit. Database rollback must be planned per migration and must not delete existing records. Do not mark a migration applied based on local files alone.
