import type { BrowserContext } from '@playwright/test';

/**
 * amtrak.com uses OneTrust for cookie consent. If the banner (or its "Preference
 * Center" dark overlay) is showing, it intercepts pointer events and every click
 * into the search form fails.
 *
 * Pre-seeding the OneTrust cookies suppresses the banner entirely, which is far more
 * reliable than racing to click "Accept" after load. `BasePage.dismissConsentBanners`
 * stays as a belt-and-braces fallback.
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
