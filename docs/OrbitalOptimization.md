# Orbital mode optimization and cost controls

This checklist keeps the mechanical sprite pipeline fast while preserving the rigid 4x2 grid contract.

## Gemini generation
- **Default model:** Runs on `gemini-2.5-flash` (standard image model) for a balance of quality and latency.
- **Premium fidelity:** `generateOrbitalAssets(..., { model: "gemini-3.0-pro" })` pushes quality highest for the 4x2 grid while costing more.
- **Cheapest toggle:** `generateOrbitalAssets(..., { model: "gemini-2.5-flash-lite" })` cuts cost/latency while keeping the prompt intact.
- **Resolution override:** `imageSize: "768p"` reduces bytes and decode time for cheaper runs. Leave the default `"1K"` when you need the sharpest cylindrical warp edges.
- **4x2 enforcement:** The prompt now explicitly rejects 4x4 (16-cell) sheets. If Gemini regresses to a square canvas, regenerate until the output is 1024x512 (2:1) with exactly eight cells.
- **Parallel vs staged runs:** The service already runs both rings in `Promise.all`. For API quotas, temporarily stage them by calling `generateRing` sequentially.
- **Cache by hash:** hash the `front/back` inputs and cache completed `pitch0/pitch30` URLs to skip duplicate generations when the references did not change.

## Web runtime
- **Texture upload budget:** Keep sprite sheets under ~2–4 MB when possible; smaller `imageSize` values shrink GPU upload time and memory while still respecting the 4x2 topology.
- **Decode off the main path:** Call `createImageBitmap` during idle time before `texImage2D` to move decode work off the render thread.
- **Frame smoothing:** The current shader blends frames by yaw; combining with a velocity low-pass on the quaternion bridge can further reduce visible repeats without increasing frame count.
- **GPU feature detection:** Continue using the WebGL availability overlay; fall back to a CSS-only preview if `isSupported` is false to avoid blank canvases on constrained devices.

## Pages deployment
- **Static bundle safety:** Secrets are stripped during the Pages build. Require runtime entry (sessionStorage or AI Studio) to keep credentials out of the CDN.
- **Base path:** Vite auto-derives the GitHub Pages base when `GITHUB_PAGES=true`; avoid hard-coding paths so previews work locally (`npm run dev`) and on Pages.
