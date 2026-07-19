import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // live tests hit real provider APIs and spend credits; run via `pnpm test:live`
    exclude: ["test/live/**"],
  },
});
