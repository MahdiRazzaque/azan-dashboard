import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    globals: true,
    pool: "threads",
    setupFiles: [path.resolve(__dirname, "../client/tests/setup.js")],
    include: ["client/tests/**/*.test.{js,jsx}"],
    deps: {
      optimizer: {
        web: { enabled: true },
      },
    },
    coverage: {
      provider: "v8",
      all: true,
      include: ["client/src/**/*.js", "client/src/**/*.jsx"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../client/src"),
    },
  },
});
