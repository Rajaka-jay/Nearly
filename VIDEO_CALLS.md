# Nearly video calls

Sign into separate paired accounts and keep Nearly open. Choose **Call your person → Start video call**, allow the camera and microphone, and have the other partner press **Answer**. Drag the heading to move the window, or focus it and use arrow keys (Home resets the position). Controls include minimize, expand, mute, camera off, camera switching, hang up, and supported-browser picture-in-picture.

The main app embeds Grove in a same-origin frame so moving between Home, games, memories, messages, and the garden preserves the call. Reloading or leaving the document ends it; the browser warns while media is active. Closed apps and suspended mobile browsers cannot receive calls. Optional browser alerts use Nearly's existing opt-in and generic notification text.

## Backend and privacy

Apply `supabase/video_calls.sql` once. The deployed RPC `nearly_call` intentionally uses SECURITY DEFINER: every action derives current pair membership and user identity from the authenticated session; direct writes and anonymous calls are denied. RLS permits SELECT only by current connected participants. Device identifiers prevent competing tabs from answering or changing one another's calls. Signaling is serialized per space, one call is active at a time, candidates are bounded and deduplicated, and calls expire without heartbeats. Realtime carries update notifications with polling recovery.

Media travels via WebRTC and is not recorded by Nearly. Only connection descriptions/network candidates enter Supabase. They are erased on hangup or on the next read after expiry. Ended metadata is removed on reads after one day. Ringing expires after 60 seconds; accepted calls send heartbeats every 15 seconds with a 60-second lease.

## TURN relay configuration

The `nearly-call-ice` Edge Function is deployed with JWT verification. It verifies pairing and can issue short-lived coturn REST credentials. Configure **Supabase Edge Function secrets**:

- `TURN_URLS`: a JSON array of your own coturn URLs, e.g. `["turn:relay.example.com:3478?transport=udp","turns:relay.example.com:5349?transport=tcp"]`.
- `TURN_SHARED_SECRET`: your coturn `static-auth-secret` (`use-auth-secret` enabled).

Keep permanent secrets out of GitHub and browser configuration. The function signs a four-hour credential for the authenticated user. No relay account or paid plan is created automatically. **These secrets are not configured yet.** Without them the function returns STUN-only direct connections and `relayConfigured:false`; these may fail across carrier NAT, firewalls, or restrictive Wi-Fi. The interface explains failed connectivity.

## Verification

`npm run check` checks JavaScript syntax. `npm test` includes database authorization/lifecycle tests and controller tests using simulated media/peers. `cd grove-app && npm run build` checks TypeScript and produces the static export. Copy `grove-app/out/` into tracked `grove/` for branch-based Pages deployment; the Actions deployment also builds the export.

Automated tests do not establish real camera or carrier connectivity. After configuring TURN, test two real paired devices on Wi-Fi/4G and 4G/4G, permission denial, simultaneous calls, network loss, tab closure, and mobile background/foreground behavior.

## Managed TURN setup (added after cross-network testing)

The ICE function now supports these choices, in priority order:

1. **Cloudflare Realtime TURN**: set `CF_TURN_KEY_ID` and `CF_TURN_API_TOKEN` in Supabase Edge Function secrets. Create a TURN key in Cloudflare's Realtime dashboard. The function requests four-hour credentials from Cloudflare; the master API token stays server-side.
2. **Metered TURN**: set `METERED_TURN_CREDENTIALS_URL` to the credential's HTTPS Get Credential API URL (`https://<app>.metered.live/api/v1/turn/credentials?apiKey=<credential-api-key>`). Copy it from your credential's instructions in the Metered dashboard. Keep the entire URL in Supabase secrets, since it contains the API key. Only the provider's ICE server entries reach the paired clients.
3. **Your own coturn**: existing `TURN_URLS` + `TURN_SHARED_SECRET` support remains.
4. **Other TURN providers**: set `TURN_URLS` (JSON array), `TURN_USERNAME`, and `TURN_PASSWORD`. These must be actual TURN credentials, not the Supabase service-role key. Prefer expiring credentials and rotate according to the provider's instructions.

Optionally set `TURN_FORCE_RELAY=true` to test a configured relay without direct connections. Remove it or set `false` after the test if you want automatic route selection.

No managed provider is connected by this code change. Provider signup, service activation and secret entry must be completed by the project owner. Check the provider's current usage limits and billing before activating a plan. After setting secrets, reload both devices and test on separate networks. The setup is not verified until a real relay-backed call passes.

Missing relay settings are shown before a direct call is attempted. A failed ICE configuration request stops call setup instead of silently falling back to STUN. The remote audio prompt now checks the current connection and ignores delayed playback rejections from an ended call.
