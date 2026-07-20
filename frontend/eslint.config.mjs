import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // We intentionally use effects to fetch on mount, poll live data, and
      // apply the persisted theme — the canonical "sync with an external
      // system" use of effects. This experimental rule false-positives on
      // exactly that pattern, so it is disabled project-wide.
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
