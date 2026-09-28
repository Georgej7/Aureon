import path from "path";
import { defineConfig } from "vitest/config";

// Mirrors tsconfig.json's "@/*" path alias -- vitest doesn't read tsconfig
// paths on its own. Node environment is enough for now since the only
// tests here (webhook pure-logic tests) don't touch the DOM; add jsdom
// later if component tests are introduced.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
  },
});
