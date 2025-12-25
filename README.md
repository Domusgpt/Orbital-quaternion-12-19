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

The repository already includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that builds the Vite site and publishes the `dist` folder to GitHub Pages. To turn it on:

1. Push your changes to the `main` branch so the workflow file is present in the repo.
2. In **Repository Settings → Pages**, set the source to **GitHub Actions**. (The workflow will upload the static bundle and trigger the Pages deploy job.)
3. In **Settings → Actions → General**, ensure Actions are enabled for the repository and that GitHub Pages deployments are permitted for workflows.
4. (Optional) In **Settings → Secrets and variables → Actions**, add `GEMINI_API_KEY` and `VITE_GEMINI_API_KEY` if you want them available to other workflows or local overrides. The deploy workflow deliberately sets these to empty strings during the build so the keys are never bundled into the static assets; users will input the key at runtime via the UI/session storage.

Once enabled, every push to `main` will build and deploy automatically. The published site URL will appear in the Pages section of the repository settings and in the deployment output of the workflow run.
