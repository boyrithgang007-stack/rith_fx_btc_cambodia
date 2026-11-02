# Welcome page — Mt project 2.mp4

## Dev and 3D control styling

Started `npm.cmd run dev` on port 3000 and left it running at the user's request. Added `depth-motion.css` with teal raised buttons, pressed/hover states, a light sweep, layered heading shadows and subtle 3D heading motion. Primary market and sign-in actions receive matching depth. Disabled controls and reduced-motion settings remain supported; the existing pause control also pauses welcome heading motion.

Dev HTTP checks returned 200 for the welcome, dashboard sign-in and portrait. The new depth stylesheet is served and TypeScript passes. Current browser inventory reports both the browser access host and native Computer Use pipe unavailable, so visual comparison and live hover/animation checks could not be completed. Reference composition has been reviewed from the sampled video and supplied screenshot; pixel equivalence is not certified.

## Portrait interaction follow-up

The portrait orbit is now hidden by default. Mouse/pen hover or keyboard focus reveals it; clicking/tapping toggles a pinned state. Leaving the portrait hides an unpinned orbit; Escape clears the interaction. The thick tube was reduced to a slim circular orbit with changing inclination and a moving satellite, split in front of/behind the photograph. Hidden or offscreen orbits do not run an animation loop; pause and reduced-motion settings remain respected. Lint has no errors (four existing image warnings); visual browser interaction remains unverified.

The latest user request makes the supplied white portfolio video the reference for the welcome page. `/` now consistently shows this welcome page to guests and signed-in users. `/dashboard` remains the protected analytics workspace. `/home` already redirects to `/`.

## Implementation

- Rebuilt `PublicLanding.tsx` and replaced `portfolio.css` with a scoped welcome design: warm white background, oversized dark condensed Latin heading, compact navigation, portrait composition, blue/yellow decorative tube, teal actions, two-column product showcase and minimal footer.
- Added Khmer/English language switching, section navigation, a skip link, dashboard links and an explicit motion pause/resume button.
- Used ImageGen to create a transparent portrait derivative at `public/images/rith-welcome-cutout.png`. The original `rith-profile.jpeg` remains intact. The derivative has an alpha channel and is served through Next Image with responsive sizes.
- `WelcomePortrait.tsx` draws a projected tube mesh into front/back canvas layers around the photograph. The photograph has subtle idle motion. The tube stays below the face. The mesh phase is preserved when paused; reduced-motion, document visibility, intersection visibility and resize are handled, with observer/listener/animation cleanup on unmount. The portrait remains visible without canvas support.
- Showcase artwork represents product categories; it does not present simulated prices or investment results. It replaces the reference portfolio's unrelated projects with actual system navigation.

This is an adaptation of the supplied video's composition and palette, not the original author's source or identical 3D model. Existing dashboard/data/account features remain separate from the welcome styles.

## Verification

Lint passes with four existing image optimization warnings elsewhere in the application. Production build and TypeScript pass. The browser connection reports an unavailable access host; launching the installed Brave app returned no targetable window. The existing VS Code preview could be discovered, but native interaction requires user-granted app access. Browser screenshot comparison, mobile interaction and animation/console checks remain unverified.

Production HTTP checks pass: `/` renders the welcome, portrait, language and motion controls; the portrait source and Next Image optimization endpoint both return 200. `/dashboard` retains its sign-in gate and the market API returns 401 for guests. The temporary verification server was stopped afterward.

## Shared UI palette follow-up

The user's next request applies the latest video palette across the UI. Light mode now shares the welcome's warm white `#fafaf7`, ink `#19202a`, teal `#087f77`, subtle gray borders and flat controls. This includes the overview terminal, account sections and sign-in surface; light overview no longer forces dark surfaces. NR material badges in the light sidebar/account header are replaced by the existing RFX text mark. Explicit dark mode remains available. The final production build and TypeScript pass; native screenshot verification remains pending as above.
