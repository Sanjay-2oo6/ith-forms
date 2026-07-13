import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Integration tests hit the REAL Supabase project from .env (they create
// test forms/submissions), so they are opt-in via a dedicated command:
//   npm run test:rpc
// They are intentionally excluded from plain `npm test`.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 30_000,
    // Sequential: tests share created fixtures and count-sensitive checks.
    pool: "forks",
    maxConcurrency: 1,
  },
});
