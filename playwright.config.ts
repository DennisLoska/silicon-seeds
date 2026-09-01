import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    headless: true,
  },
  webServer: {
    command: "bun run build && bun src/main.ts",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      NODE_ENV: "test",
      COMFYUI_BASE_URL: process.env.COMFYUI_BASE_URL ?? "http://127.0.0.1:8188",
      COMFYUI_BASE_WS: process.env.COMFYUI_BASE_WS ?? "ws://127.0.0.1:8188",
      OUTPUT_DIR: process.env.OUTPUT_DIR ?? "/tmp/comfy_output",
      INPUT_DIR: process.env.INPUT_DIR ?? "/tmp/comfy_input",
      CONTENT_LIBRARY_DIR: process.env.CONTENT_LIBRARY_DIR ?? "/tmp/content_library",
      LLM_MODEL: process.env.LLM_MODEL ?? "qwen3.6-35b-a3b",
      EMBEDDING_MODEL: process.env.EMBEDDING_MODEL ?? "text-embedding-qwen3-embedding-8b",
      CHROMADB_HOST: process.env.CHROMADB_HOST ?? "127.0.0.1",
      CHROMADB_PORT: process.env.CHROMADB_PORT ?? "8000",
      VOICEBOX_URL: process.env.VOICEBOX_URL ?? "http://127.0.0.1:17493",
      LOG_LEVEL: process.env.LOG_LEVEL ?? "info",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
