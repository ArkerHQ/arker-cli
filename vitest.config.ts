import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@arker-ai/sdk": resolve(import.meta.dirname, "../arker-sdk/typescript/src/index.ts"),
    },
  },
  test: {
    environment: "node",
  },
});
