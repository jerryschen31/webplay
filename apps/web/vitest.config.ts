import { defineConfig } from "vitest/config";

export default defineConfig({
  // tsconfig uses "jsx": "preserve" for Next.js; vitest must transform it
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
  },
});
