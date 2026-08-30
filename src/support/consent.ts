import type { BrowserContext } from '@playwright/test';

/**
 * amtrak.com's OneTrust consent banner intercepts pointer events until dismissed.
 * Pre-seeding its cookies suppresses it entirely — more reliable than racing to click
 * "Accept" after load. `BasePage.dismissConsentBanners` is the fallback.
 */
export const seedAmtrakConsent = async (context: BrowserContext): Promise<void> => {
  const now = new Date().toISOString();
  await context.addCookies([
    {
      name: 'OptanonAlertBoxClosed',
      value: now,
      domain: '.amtrak.com',
      path: '/',
    },
    {
      name: 'OptanonConsent',
      value: `isGpcEnabled=0&datestamp=${encodeURIComponent(now)}&version=202401.1.0&groups=C0001:1,C0002:1,C0003:1,C0004:1`,
      domain: '.amtrak.com',
      path: '/',
    },
  ]);
};
