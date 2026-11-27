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

## Full-screen garden

The expand button in the garden toolbar fills the viewport and hides the surrounding dashboard while preserving tree, memory, watering, journal and appearance interactions. Exit uses the same button or Escape and restores focus/scroll. `useGardenFullscreen.ts` requests native document fullscreen after a click where available, otherwise uses an immersive CSS viewport. The document remains the fullscreen element so native dialogs stay usable. In the embedded main app, `grove-link.js` accepts layout messages only from the active same-origin Grove frame; a CSS fallback expands that iframe on browsers without native fullscreen. Navigating away clears the host layout state. Browser chrome may remain visible on iOS.

Verified with synthetic scene data: full viewport bounds on desktop, 390px iframe fallback, settings access, exit and Escape focus restoration. Native OS fullscreen on physical iOS/Android was not verified.

## Visitors and shared garden moments — 27 November 2026

`GardenVisitors.tsx`, `GardenObjectDialog.tsx` and `garden-life.css` add generated transparent cat poses, a butterfly and a robin. The cat sleeps, stretches and wanders on a slow routine, reacts to taps and tilts toward a nearby mouse. Visitors appear intermittently in daylight; the robin arrives from stage 3. Hover/focus pauses the cat's wandering; paused/system reduced-motion modes suppress movement. Soft synthetic interaction tones only play after sound is enabled. These are animated image poses, not skeletal animation. No microphone or presence tracking is used.

Placed objects now offer object-specific moments as well as access to the existing movement/removal editor: swing push, a quiet bench breath, flower bloom, latest memory frame, lantern note, picnic question, or journal. The daily picnic question is deterministic by UTC day and carries into the memory composer. Lantern/cottage notes use real saved memories; up to three existing memories appear as clickable sky lights. More decorative flowers appear at growth point milestones. Saved water events trigger a tree shake, root sparkles and extra petals. Window/lantern light pulses and gets brighter after dusk.

The additive `supabase/couple_grove_life.sql` was deployed as `nearly_grove_living_interactions`. `grove_visit(kind)` derives identity and membership from the session, validates the object type, serializes with the existing couple lock, and grants **one shared point for the first interaction per user per couple per UTC day**. Later taps only save each object's first daily visit; retries cannot grant more points. Direct client access to the interaction table is revoked, RLS is enabled, and reads require the current pair snapshot. The new RPC returns the original Grove state plus up to forty saved interaction traces. First daily visits appear in the journal and object panels. A partner's recent swing visit can replay a gentle sway on arrival. State updates trigger existing Realtime invalidation; the reconnect poll remains as fallback.

Security advisors flag authenticated execution of the new SECURITY DEFINER RPC. This is intentional for the narrowly validated API: anonymous execution is revoked, an empty search path is used, and identity/pair membership are checked before any reads or writes. See https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable. No new anonymous grants or direct client write privileges were added.

Verification: full root tests including `tests/grove-life.mjs` (daily caps/reset, retries, two partners, unrelated/anonymous users, direct-write denial and replacement-partner isolation); live RPC grant/RLS/search-path checks; Next.js type/build checks; synthetic desktop/mobile UI checks for cat poses/taps, visitor response, swing/bench dialogs, picnic prompt, fullscreen modal Escape, and paused motion. No production users were messaged or awarded points for testing. Real two-device Realtime delivery and physical iOS audio were not retested.

Still outside this update: live weather/rainbows, birthdays/fireworks, opt-in partner avatars, haptics, a crystal shop, hidden-reward counters and timed cooperative blooms. These are not represented by fake state.
