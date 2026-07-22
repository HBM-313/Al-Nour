import path from "node:path";
import { defineConfig } from "vitest/config";

// Selvstændig test-konfig (ikke merged med vite.config.ts) for at undgå at
// trække PWA-plugin'et (VitePWA genererer service worker/manifest-filer,
// som hverken giver mening eller virker i et Node/jsdom-testmiljø) ind i
// testkørslen. Alias og TS-opsætning holdes i sync med vite.config.ts /
// tsconfig.app.json manuelt — begge peger "@" på "./src".
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    restoreMocks: true,
  },
});
