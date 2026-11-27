# Couple Grove

A Next.js, React, TypeScript, Tailwind, Framer Motion and Supabase feature at `/Nearly/grove/`. It shares the original site's Supabase authentication session and derives membership from the existing `nearly_spaces` record. No user data is embedded in the source.

`npm ci && npm run build` produces a static Next.js export for the existing GitHub Pages origin. The public project URL/key are client settings. Privileged writes execute in the `grove_action` PostgreSQL function.

## Implemented

Five visual growth stages, daily watering, transactional growth rewards, cooperative daily goals, gift quantities and daily gift limits, memory seeds with optional private Storage images, own-memory deletion, a journal, decoration selection/placement/removal with keyboard-accessible position controls, relationship date settings, notification preview preferences, authenticated Realtime invalidation, reconnect polling, disabled/loading/error states, reduced motion, and development-only tree previews.

`lib/assets.ts` owns the replaceable environment asset. All named UI components are exported from `components/CoupleGrovePage.tsx` for reuse. Server stage thresholds are 0, 50, 200, 500 and 1000 points. Daily limits reset at 00:00 UTC.

## Scope still requiring integration

The existing app has no independent check-in/prompt completion API to bind to. This version exposes real watering, memory and decoration goals, rather than rewarding arbitrary client assertions. Weekly goals, automatic check-in/prompt rewards, completed-goal/important-date journal imports, rotation controls, per-item inventory use effects, account deletion and closed-app push are not implemented here. The main app retains its existing account/pairing controls. The garden has a dedicated generated forest clearing. Swing props use a gentle visual animation rather than physics.

## Verification

Next.js production build and TypeScript checks pass. Deployed database checks, executed inside a rolled-back transaction, verified watering rewards, watering duplication protection, both-partner goal rewards, gift daily limits and unrelated-account rejection. Tables have RLS and the image bucket is private. Two-browser end-to-end UI, actual file upload/retrieval, Realtime delivery, screen-reader and mobile viewport checks remain required before a production sign-off.

The schema was applied to the connected Nearly Supabase project using its management connection. Do not rerun the original schema file on an existing project. It is retained as source history.

## Living garden update — 27 November 2026

`components/GroveScene.tsx` and `app/living-garden.css` provide the immersive garden: time-of-day light, stars/aurora and fireflies after dusk, petals in spring, pollen-like motes in summer, autumn leaves and winter snow. Time uses the current device clock (updated each minute); it does not infer a partner timezone. Seasons are explicit decorative moods chosen per device, not local weather. The default mood is spring. Existing server-authoritative stages choose five distinct tree images and scale; stage changes crossfade.

Up to eight current memories become labelled keyboard-accessible heart ornaments (seeds near the ground for the early stages). Opening one reads only the already-authorized couple state; optional photos still use authenticated Storage signed URLs. Hotspots open the existing gift basket, memory form, decoration editor and journal. Placed decorations can open the existing position/removal editor. No new rewards or privileged endpoints were added. Water ripples/glow follow a new saved water event, never a button click alone.

Motion can be paused and honors system reduced motion. Optional quiet wind is synthesized with Web Audio only after a deliberate toggle, stops when the tab hides, and cleans up on unmount. No audio stream, autoplay, microphone, presence broadcasts or location permission is used. Local storage holds only season/motion appearance preferences; shared progress remains in Supabase.

The garden is larger and the task/inventory/sidebar type is more readable. Existing cooperative goals show per-partner completion steps and real reward states. The completed watering button remains warm and legible. Crystal spending, surprise rewards, cooperative timed blooms, blended timezones, live weather, milestone fireworks and new creature unlocks are not implemented or implied by this visual update.

Validation: TypeScript and static production build; pure time-boundary/season checks; desktop and 390px mobile browser UI using a temporary synthetic fixture (excluded from production). Checked ornament callback, season selection, motion pause computed animation state, sound toggle, stage 1/4/5 rendering and saved-water disabled state. Real two-partner Realtime, iOS audio and private photo retrieval were not retested in this update.
