# Ocean Breeze dark mode

The latest supplied references define the dark-mode design across the system. Light mode retains the Apple Modern palette. Dark mode now shares Ocean Breeze tokens: primary `#0B3D91`, secondary `#3BA7F2`, mint `#7FE7D6`, and ice `#E8F6FF`. The dark canvas is a deeper navy derived from the primary; ice is used for readable text rather than a bright dark-mode background.

`ocean-dark.css` applies the palette after earlier surface styles. Welcome, Overview, market/strategy/macro, account, sign-in, membership, learning and news use consistent blue glass surfaces, mint links/focus highlights and blue raised actions. Overview icons, area/volume charts and market-cap composition/legend inherit the palette. Financial gain/loss colors retain distinct semantic meaning. Dark theme previews match the new palette. Existing two-mode persistence and motion controls are unchanged.

Validation: production build and TypeScript pass; the homepage responds successfully and the new stylesheet is served. Browser screenshot/hover verification remains unavailable, so exact visual equivalence to the reference images is not certified.
