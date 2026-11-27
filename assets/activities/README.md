# Nearly activity photography

22 generated photo-style covers replace the former SVG/emoji activity covers. These are AI-generated editorial still lifes, not documentary photographs or screenshots of external games. Generated using the built-in image generation tool on 27 November 2026.

Runtime registry: `activity-art.js`. Every image is hosted locally as an 800 × 480 WebP. The shared registry serves the Play catalogue, Home activity recommendations, external game cards, and their instruction dialogs. Covers are decorative because adjacent labels name each activity. Native lazy loading, async decoding, fixed dimensions, and `object-fit: cover` keep layout stable.

Source generation prompts are in `prompts.json`. The common direction is natural warm daylight, realistic paper/wood/ceramic textures, cream/blush/sage/lavender accents, centered subjects with cropping room, no people, brands, UI, emojis, vector artwork, borders or watermarks. Game boards are cover photography and do not define the playable game rules.

Replace a file with the same name and 5:3 aspect ratio to update a cover. Retain the activity IDs and bump the cache version of the consuming stylesheet/script if needed.
