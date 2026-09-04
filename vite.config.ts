import { defineConfig } from "vitest/config";
export default defineConfig({
  base: "./",
  build: { target: "es2022", outDir: "dist", chunkSizeWarningLimit: 800 },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
  },
});
