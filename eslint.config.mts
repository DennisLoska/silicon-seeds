import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  tseslint.configs.recommended,
  globalIgnores([
    "**/node_modules/**",
    "**/dist/**",
    "**/static/*.min.*",
    "**/static/style.css",
    "**/coverage/**",
  ]),
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.bunBuiltin, ...globals.browser } },
  },
  {
    rules: {
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    files: ["migrations/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    files: ["src/db/**", "src/comfyui/**", "src/api/**", "src/jobs/**", "src/video/**", "src/image/**", "src/queue/**", "src/client/**", "src/prompts/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
]);
