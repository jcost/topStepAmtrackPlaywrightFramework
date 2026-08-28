import type { Page } from '@playwright/test';

/**
 * Shared base for **component objects** — reusable sub-regions of a page
 * (e.g. the "Find trains" search widget, a global header, a modal).
 *
 * Same contract as {@link BasePage}: arrow-function locators, multi-step methods
 * allowed, never any assertions.
 */
export abstract class BaseComponent {
  protected constructor(protected readonly page: Page) {}
}
