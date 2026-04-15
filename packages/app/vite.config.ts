/// <reference types="vitest" />
import { resolve } from "node:path"
import { defineConfig } from "vite"
import solid from "vite-plugin-solid"

const isTauri = process.env.TAURI_ENV_PLATFORM !== undefined

export default defineConfig({
  plugins: [solid()],
  resolve: {
    alias: {
      "@coda/core": resolve(__dirname, "../core/src/index.ts"),
      "@coda/ui": resolve(__dirname, "../ui/src/index.ts"),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: isTauri ? "127.0.0.1" : "127.0.0.1",
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: "es2022",
    minify: "esbuild",
    sourcemap: true,
  },
  test: {
    environment: "happy-dom",
    globals: true,
    include: ["src/**/*.{test,vitest}.{ts,tsx}"],
    coverage: { reporter: ["text", "lcov"] },
  },
})
