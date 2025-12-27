import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");

  const resolvedGeminiKey = env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || "";

  // For GitHub Pages: use repo name as base path, or "/" for custom domain
  const base = process.env.GITHUB_REPOSITORY
    ? `/${process.env.GITHUB_REPOSITORY.split('/')[1]}/`
    : "/";

  return {
    base, // Set dynamically for GitHub Pages deployment
    server: {
      port: 3000,
      host: "0.0.0.0",
    },
    plugins: [react()],
    define: {
      "process.env.API_KEY": JSON.stringify(resolvedGeminiKey),
      "process.env.GEMINI_API_KEY": JSON.stringify(resolvedGeminiKey),
      "process.env.VITE_GEMINI_API_KEY": JSON.stringify(resolvedGeminiKey),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
  };
});
