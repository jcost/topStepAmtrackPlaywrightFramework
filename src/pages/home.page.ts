import type { Page } from '@playwright/test';

import { BasePage } from './base.page';
import { FindTrainsForm } from './components/find-trains-form.component';

/**
 * amtrak.com/home.
 *
 * Owns the {@link FindTrainsForm} component object. Additional homepage regions
 * (global nav, deals carousel, alerts banner) would be added here as more
 * component objects as the suite grows — see docs/SCALABILITY.md.
 */
export class HomePage extends BasePage {
  readonly findTrainsForm: FindTrainsForm;

  constructor(page: Page) {
    super(page);
    this.findTrainsForm = new FindTrainsForm(page);
  }

  /** Navigate to the homepage and get the search widget interactive. A real navigation
   *  failure (DNS, timeout, connection refused) throws here; whether the *widget* then
   *  loaded is decided by the readiness gate in `pom.fixtures.ts`. */
  open = async (): Promise<void> => {
    await this.navigate('/home');
    await this.dismissConsentBanners();
    await this.findTrainsForm.waitUntilReady();
  };
}
