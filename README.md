<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1KcIQcg0JZpUS5MtEoOYKcFmJdBIx62lj

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Deploy to GitHub Pages

The repository ships with a Vite-first GitHub Actions workflow (`.github/workflows/deploy.yml`) that builds the production bundle (`npm run build`) and publishes the `dist` output to GitHub Pages.

### One-time setup
1. Push the workflow to your default branch (main).
2. In **Repository Settings → Pages**, set **Source** to **GitHub Actions**.
3. In **Settings → Actions → General**, allow GitHub Actions and GitHub Pages deployments.
4. (Optional) In **Settings → Secrets and variables → Actions**, add `GEMINI_API_KEY` and `VITE_GEMINI_API_KEY`. They are logged as “present” for observability but are explicitly emptied during the Vite `npm run build` step so they never enter the static bundle.

### How deploys work
- Every push to `main` triggers the workflow: checkout → install → **vite build** → upload `dist` → deploy to Pages.
- The workflow sets `GITHUB_PAGES=true`, letting Vite automatically derive the correct `base` path (i.e., `/<repo>/`) for GitHub Pages asset URLs.
- Pages URLs surface in the workflow summary and in **Settings → Pages** once the deployment succeeds.

## Performance and cost tuning

- The orbital generator now defaults to `gemini-2.5-flash` (standard image model) and accepts overrides for `gemini-3.0-pro` (maximum fidelity) and `gemini-2.5-flash-lite` (cheapest) plus image size, letting you trade fidelity for latency or cost without changing the rigid 4x2 layout. See `generateOrbitalAssets` in `services/OrbitalGenService.ts` for the knobs.
- The prompt enforces an **exact 4×2 (eight-cell) grid** and explicitly rejects 4×4 outputs to avoid duplicated yaw slices. If you see a 4×4 sheet, regenerate—it’s considered invalid for the shader.
- A deeper checklist for generation/runtime/Pages optimizations lives in [`docs/OrbitalOptimization.md`](docs/OrbitalOptimization.md).
