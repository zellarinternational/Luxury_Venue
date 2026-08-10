import { defineConfig } from "vitest/config";
import path from "path";

const dirname = import.meta.dirname;

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(dirname, "src"),
      "@server": path.resolve(dirname, "server"),
    },
  },
});
