import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: false,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Pas de DB réelle en tests unitaires — les fonctions de validation
    // sont pures et prennent leurs données en entrée.
  },
});
