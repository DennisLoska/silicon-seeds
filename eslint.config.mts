import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  tseslint.configs.recommended,
  globalIgnores(["**/node_modules/**", "**/static/**", "**/*.min.*"]),
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: globals.bunBuiltin },
  },
  {
    rules: {
      "@typescript-eslint/no-namespace": "off",
    },
  },
]);
