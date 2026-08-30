/**
 * Local ESLint plugin enforcing the Page Object contract inside `tests/**`.
 *
 * `pom/no-raw-locators`:
 *   1. No raw locator builders in a spec (`page.getByRole(...)`, `.locator(...)`, `.$(...)`, …)
 *      — put the locator on a Page Object and reach it through the injected fixture.
 *   2. No `new SomethingPage()` / `new SomethingComponent()` in a spec — register it in
 *      `src/fixtures/pom.fixtures.ts` and inject it.
 */

const LOCATOR_BUILDERS = new Set([
  'locator',
  'getByRole',
  'getByText',
  'getByLabel',
  'getByPlaceholder',
  'getByAltText',
  'getByTitle',
  'getByTestId',
  'frameLocator',
  '$',
  '$$',
  '$eval',
  '$$eval',
]);

/** @type {import('eslint').Rule.RuleModule} */
const noRawLocators = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow raw Playwright locators and Page Object instantiation inside test files; use Page Objects injected via the POM fixture.',
    },
    schema: [],
    messages: {
      rawLocator:
        "Raw locator `.{{name}}(...)` is not allowed in a test. Add this locator as an arrow-function property on a Page Object (src/pages/**) and reach it through the injected fixture (e.g. `homePage.findTrainsForm.fromStationInput()`).",
      newPageObject:
        "Do not instantiate `{{name}}` in a test. Register the Page Object in src/fixtures/pom.fixtures.ts and inject it via the test callback args.",
    },
  },

  create(context) {
    return {
      CallExpression(node) {
        const { callee } = node;
        if (
          callee.type === 'MemberExpression' &&
          !callee.computed &&
          callee.property.type === 'Identifier' &&
          LOCATOR_BUILDERS.has(callee.property.name)
        ) {
          context.report({
            node: callee.property,
            messageId: 'rawLocator',
            data: { name: callee.property.name },
          });
        }
      },

      NewExpression(node) {
        if (node.callee.type === 'Identifier' && /(?:Page|Component)$/.test(node.callee.name)) {
          context.report({
            node,
            messageId: 'newPageObject',
            data: { name: node.callee.name },
          });
        }
      },
    };
  },
};

export default {
  meta: { name: 'eslint-plugin-pom', version: '1.0.0' },
  rules: {
    'no-raw-locators': noRawLocators,
  },
};
