import tseslint from 'typescript-eslint';
import pom from './eslint-rules/pom-plugin.mjs';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'playwright-report/**',
      'blob-report/**',
      'test-results/**',
      'playwright/.cache/**',
    ],
  },

  ...tseslint.configs.recommended,

  {
    files: ['src/**/*.ts', 'tests/**/*.ts', 'playwright.config.ts'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': ['warn', { allowExpressions: true }],
      '@typescript-eslint/no-non-null-assertion': 'warn',
    },
  },

  /*
   * GUARD 1 — Assertions live in tests, never in Page Objects / components.
   * Flags `expect(...)`, `expect(...).toX(...)` and `expect.poll(...)` under src/pages/**.
   */
  {
    files: ['src/pages/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='expect']",
          message: 'Assertions belong in tests, not Page Objects. Return a Locator/value and assert in the spec (docs/FRAMEWORK.md).',
        },
        {
          selector: "CallExpression[callee.object.name='expect']",
          message: 'Assertions belong in tests, not Page Objects. Return a Locator/value and assert in the spec (docs/FRAMEWORK.md).',
        },
        {
          selector: "CallExpression[callee.object.callee.name='expect']",
          message: 'Assertions belong in tests, not Page Objects. Return a Locator/value and assert in the spec (docs/FRAMEWORK.md).',
        },
      ],
    },
  },

  /*
   * GUARD 2 — No raw locators in tests; a new page surface means a new Page Object + fixture entry.
   */
  {
    files: ['tests/**/*.spec.ts'],
    plugins: { pom },
    rules: {
      'pom/no-raw-locators': 'error',
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@playwright/test',
              message:
                "Import { test, expect } from 'src/fixtures/pom.fixtures' so Page Objects are injected automatically.",
            },
          ],
          patterns: [
            {
              group: ['**/pages/**'],
              message:
                'Do not import Page Objects directly in a test. Register them in src/fixtures/pom.fixtures.ts and inject via the test callback.',
            },
          ],
        },
      ],
    },
  },

  /*
   * Support code (global setup, local ESLint rules) — relax the stylistic rules.
   */
  {
    files: ['tests/_support/**/*.ts', 'eslint-rules/**/*.mjs'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      'no-restricted-syntax': 'off',
    },
  },
);
