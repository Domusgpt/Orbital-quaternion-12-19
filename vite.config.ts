import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");

  const resolvedGeminiKey = env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || "";

  const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1];
  const isPages = process.env.GITHUB_PAGES === "true" && repoName;
  const base = isPages ? `/${repoName}/` : "./";

  return {
    // Derive the base path automatically when the Pages workflow sets GITHUB_PAGES=true
    // so assets resolve under https://<user>.github.io/<repo>/.
    base,
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
