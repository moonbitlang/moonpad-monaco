import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  workers: 1,
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:4174",
    channel: process.env.PLAYWRIGHT_CHANNEL,
    viewport: { width: 1280, height: 900 },
  },
  webServer: {
    command:
      "pnpm --dir examples/vanilla preview --host 127.0.0.1 --port 4174 --strictPort",
    url: "http://127.0.0.1:4174",
  },
});
