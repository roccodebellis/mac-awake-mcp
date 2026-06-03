import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // index.ts is a one-line bin shim (parses argv, calls runCli); nothing to unit-test.
      exclude: ["src/index.ts"],
      reporter: ["text", "lcov"],
      thresholds: {
        statements: 95,
        branches: 88,
        functions: 90,
        lines: 95,
      },
    },
  },
});
