import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // `_name` marks a value that must exist but is deliberately unused (a
      // callback parameter, a key dropped with `{ id: _id, ...rest }`), and a
      // destructured sibling of `...rest` is there to strip it from the rest.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      // Only meaningful with the React Compiler, which this app does not use
      // yet: it flags react-hook-form `watch()` and TanStack Table as code the
      // compiler would skip. Turn it back on together with the compiler.
      "react-hooks/incompatible-library": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Git worktree checkouts (separate branches) must not be linted from
    // this checkout — they have their own HEAD and node_modules resolution.
    ".claude/worktrees/**",
    ".claude/projects/**",
  ]),
]);

export default eslintConfig;
