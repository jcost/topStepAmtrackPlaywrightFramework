import type { Page, Response } from '@playwright/test';

/**
 * Shared base for every Page Object.
 *
 * Contract enforced across the framework (see docs/FRAMEWORK.md):
 *  - Locators are exposed as **arrow-function properties** that return a `Locator`.
 *  - Multi-step user journeys (the "login-style" flows) may be methods here.
 *  - **No assertions** — Page Objects never call `expect`. Tests assert.
 */
export abstract class BasePage {
  protected constructor(protected readonly page: Page) {}

  /** Navigate to a path relative to `use.baseURL`. */
  protected navigate = async (path: string): Promise<Response | null> =>
    this.page.goto(path, { waitUntil: 'domcontentloaded' });

  /**
   * Belt-and-braces OneTrust dismissal. The primary defence is cookie pre-seeding
   * (see src/support/consent.ts); this handles the case where the banner still renders.
   */
  dismissConsentBanners = async (): Promise<void> => {
    const acceptAll = this.page.locator('#onetrust-accept-btn-handler');
    if (await acceptAll.isVisible().catch(() => false)) {
      await acceptAll.click({ timeout: 5_000 }).catch(() => undefined);
    }

    const confirmChoices = this.page.locator('.onetrust-close-btn-handler, .save-preference-btn-handler');
    if (await confirmChoices.first().isVisible().catch(() => false)) {
      await confirmChoices.first().click({ timeout: 5_000 }).catch(() => undefined);
    }
  };
}
