# Online games for two

**Play → Online games** opens the curated external game directory. It is also included below Nearly activities in All and Together, and it participates in the activity search. The direct directory URL is `https://rajaka-jay.github.io/Nearly/?games=online#play`.

These are outbound links, not embedded or Nearly-hosted multiplayer. Opening a provider homepage does not automatically match the two partners. The How to join dialog explains the provider's private-room or challenge flow. Partners copy the provider's invite into their conversation themselves. Nearly does not send chat messages, usernames, account IDs or invitation codes to these providers, and it does not claim to store/synchronize their game progress.

## Curated sources

Provider pages were checked on **26 November 2026**. Descriptions and instructions are paraphrased from these primary sources; provider menus, availability, account rules and device support can change. External game matches were not played end to end as part of adding this directory.

| Game | Destination / evidence | Invitation flow |
| --- | --- | --- |
| BasketBros | https://www.crazygames.com/game/basketbros | Online Host/Join with an invite code; distinct from the same-PC mode |
| Mini Golf Club | https://minigolfclub.io/multiplayer | Private game → Invite → full invite link; developer documents guest and cross-device support |
| skribbl.io | https://skribbl.io/ | Create Private Room → invitation link; nickname-based drawing and guessing |
| Jigsaw Explorer | https://www.jigsawexplorer.com/ and https://www.jigsawexplorer.com/multiplayer-jigsaw-puzzle-games/ | Select a puzzle → multiplayer → Create Game Link; nickname-based shared puzzle |
| Battleship | https://papergames.io/en/battleship | Play with a friend → shared game link; provider documents guest play |
| Lichess | https://lichess.org/ | Challenge a friend → game options → challenge link; follow provider account prompts for the selected mode |

## Maintenance

- Data and invitation instructions: `external-games.js`.
- Directory and dialog styling: `external-games.css`.
- Generated photo-style covers: `activity-art.js` and `assets/activities/`. These decorative still lifes contain no provider logos or copied game assets; they are not game screenshots.
- Load the directory after the existing activity/media wrappers in `index.html`.
- Keep HTTPS destinations on a small reviewed list. Use `target="_blank"` with `rel="noopener noreferrer"` so Nearly stays open without exposing an opener.
- Do not turn arbitrary user URLs into a trusted launch directory or iframe. Do not scrape provider artwork or promise unsupported private rooms.
- Recheck each provider's actual separate-device invitation flow when refreshing recommendations. Do not equate the label “2-player” with online remote multiplayer.
- The existing Nearly game, media, authentication and pairing implementations do not change for this feature. No new SQL, API keys or provider accounts are provisioned.

## Verification

`npm run check` validates root JavaScript syntax. `tests/external-games.test.cjs` checks search/category behavior, curated HTTPS hosts, outbound link attributes and unknown-entry rejection. Use browser QA for Online/All/Async filters, search with only an external match, How to join, keyboard focus, narrow and desktop layouts, and unchanged in-app game access. External availability and gameplay remain the provider's responsibility.
