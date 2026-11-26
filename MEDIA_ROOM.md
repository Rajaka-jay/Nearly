# Watch & listen together

Open **Play → Watch & listen together** or **Our music queue**. These open the same private room. Paste a link and a title, choose an item, and enable playback on each device. Use **Play for both**, **Pause for both**, and the shared seek slider. **Catch up to partner** realigns only your player. Device volume and the embedded player's own controls remain personal. Playback is approximate rather than frame accurate; buffering, provider ads, background suspension, and autoplay restrictions can affect alignment.

## Supported sources

- YouTube single video links (watch, short, shorts, live, and embed URLs normalize to a video ID). The official IFrame API controls playback. Some videos cannot be embedded; the UI displays provider errors and an original-link fallback. Live streams may not seek reliably.
- Direct HTTPS MP4, WebM, OGV, MP3, M4A, OGG, WAV, and AAC URLs. Actual playback depends on browser codecs and server behavior. These are URLs to files, not arbitrary movie pages, HLS manifests, DRM streams, or a screen-sharing feature.
- Spotify track, album, playlist, show, and episode links. The official embed loads on request, but playback is explicitly independent on each device. Full tracks depend on Spotify's account restrictions. For synchronized Spotify playback, use Spotify Jam in Spotify. Nearly does not collect Spotify credentials or claim that a preview player is full synchronized Spotify streaming.
- Other HTTPS websites are shared links only. Subscription services open in their own tabs and retain their normal account and playback requirements.

External players/media load only after a partner enables playback on that device. No media is proxied or recorded in Supabase. The queue includes shared URLs, so anyone with access to that couple space can see those URLs, including any access tokens embedded in a supplied signed media URL.

## Backend

Apply `supabase/media_room.sql` once. It adds `nearly_media_rooms`, `nearly_media_receipts`, and the authenticated `nearly_media` RPC. Existing game, chat, and space JSON data are not changed. RPC identity, couple membership, and the room are derived from the session; row locks, version checks and UUID receipts protect shared changes from stale or duplicate submissions. The server determines provider types and media IDs rather than trusting browser-supplied types. Both partner IDs are snapshotted so a replacement partner cannot inherit a previous pair's media queue.

The tables have RLS enabled and no client table privileges. The SECURITY DEFINER RPC uses an empty search path and explicit session/membership checks. Security advisor notices about RPC execution and RLS without table policies are intentional for this RPC-only pattern; anonymous and direct-table access are tested. See https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable and https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy.

The authoritative playhead is `position` plus elapsed server time since `anchor_at` while unpaused. Play/pause positions are calculated on the server. Responses include the server clock; clients estimate offset using the midpoint of each request. Visible rooms refresh every 1.5 seconds, including a state refresh on reconnect or tab resume. Large drift is corrected (1.5 seconds for direct media, 2 seconds for YouTube). Closing the modal stops local playback and destroys embedded players; it does not pause the other partner. An explicit shared pause does.

Queue limit: 40 items. Titles: 120 characters. HTTPS URLs: 2048 characters. Playhead limit: 24 hours. No new API credentials or payment card are required for the integration code. Provider subscriptions, availability, and normal usage terms still apply.

## Checks

Run `npm run check` and `npm test`. Tests cover link normalization, clock math, authentication and couple isolation, server-derived authorship/provider types, shared playback state, seek bounds, request idempotency, stale changes, queue removal/limits, direct table denial, and former-partner separation. Browser checks use synthetic paired sessions with the same PostgreSQL function; provider playback remains subject to real device/browser behavior.

References: https://developers.google.com/youtube/iframe_api_reference and https://developer.spotify.com/documentation/embeds and https://support.spotify.com/article/jam/.
