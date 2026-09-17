import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",                 // jsdom arrives with the ported DOM tests
    include: ["tests/**/*.test.js"],
  },
});
