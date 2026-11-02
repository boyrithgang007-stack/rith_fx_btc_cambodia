# Overview 3D update — My project.mp4

Latest direction: the Overview should use the attached dark terminal video, while the welcome remains the previously requested white portrait design.

## Changes

- Overview uses the dark cinematic theme regardless of the saved theme for other pages. Theme toggles are hidden only on Overview to avoid implying a light state there; settings and other routes retain the saved theme.
- `cinematic-terminal.css` establishes the terminal grid at desktop, tablet and mobile widths. Summary/chart panels precede the central torus; lower market statistics precede commodity/Forex panels at every width.
- Cards have beveled edges, depth shadows, a restrained pointer-controlled tilt and surface highlight. Sidebar selection, controls, KPI typography and other workspace cards receive depth treatments.
- Torus geometry now lies in the horizontal XZ plane and is projected with aspect-correct perspective. The particle mesh rotates around the vertical axis with a tilted camera view. Rendering freezes at the current phase when paused, respects reduced motion and stops its loop offscreen or in hidden tabs; listeners/observers are cleaned up.
- The pause button controls Overview CSS animations as well as the WebGL scene and pointer tilt. The torus is explicitly labeled decorative, not a market/trading signal.
- Fixed the reported KPI bug: market breadth now renders a real `<small>` child instead of printing the markup as a text string.

## Verification

47 unit tests pass. TypeScript passes. A server-rendered component smoke check with a sample asset verifies breadth markup and the scene/motion control structure. This check uses sample data and stubbed child scenes; it is not a browser or WebGL test. Dev homepage returns 200 on port 3000. Browser/native access was unavailable during the preceding checks, so hover appearance, actual shader output, screenshots and mobile interaction remain unverified. External provider outages may still show unavailable states; no sample figures are added to the running app.
