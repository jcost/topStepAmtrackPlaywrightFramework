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
   * Belt-and-braces OneTrust dismissal: click "Allow All" if the banner rendered despite
   * the pre-seeded consent cookies (see src/support/consent.ts, the primary defence).
   */
  dismissConsentBanners = async (): Promise<void> => {
    const allowAll = this.page.locator('#onetrust-accept-btn-handler');
    if (await allowAll.isVisible().catch(() => false)) {
      await allowAll.click({ timeout: 10_000 }).catch(() => undefined);
    }
  };
}
