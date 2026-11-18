# Couple Grove

A Next.js, React, TypeScript, Tailwind, Framer Motion and Supabase feature at `/Nearly/grove/`. It shares the original site's Supabase authentication session and derives membership from the existing `nearly_spaces` record. No user data is embedded in the source.

`npm ci && npm run build` produces a static Next.js export for the existing GitHub Pages origin. The public project URL/key are client settings. Privileged writes execute in the `grove_action` PostgreSQL function.

## Implemented

Five visual growth stages, daily watering, transactional growth rewards, cooperative daily goals, gift quantities and daily gift limits, memory seeds with optional private Storage images, own-memory deletion, a journal, decoration selection/placement/removal with keyboard-accessible position controls, relationship date settings, notification preview preferences, authenticated Realtime invalidation, reconnect polling, disabled/loading/error states, reduced motion, and development-only tree previews.

`lib/assets.ts` owns the replaceable environment asset. All named UI components are exported from `components/CoupleGrovePage.tsx` for reuse. Server stage thresholds are 0, 50, 200, 500 and 1000 points. Daily limits reset at 00:00 UTC.

## Scope still requiring integration

The existing app has no independent check-in/prompt completion API to bind to. This version exposes real watering, memory and decoration goals, rather than rewarding arbitrary client assertions. Weekly goals, automatic check-in/prompt rewards, completed-goal/important-date journal imports, rotation controls, per-item inventory use effects, account deletion and closed-app push are not implemented here. The main app retains its existing account/pairing controls. The garden uses the existing illustrated environment with layered tree/decorations. It does not yet have a dedicated forest artwork or a physics-based swing.

## Verification

Next.js production build and TypeScript checks pass. Deployed database checks, executed inside a rolled-back transaction, verified watering rewards, watering duplication protection, both-partner goal rewards, gift daily limits and unrelated-account rejection. Tables have RLS and the image bucket is private. Two-browser end-to-end UI, actual file upload/retrieval, Realtime delivery, screen-reader and mobile viewport checks remain required before a production sign-off.

The schema was applied to the connected Nearly Supabase project using its management connection. Do not rerun the original schema file on an existing project. It is retained as source history.
