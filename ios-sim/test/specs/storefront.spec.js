// Phone checks in real Safari on the iOS Simulator. IDs follow the plan in ../TEST-CASES.md.
// These are the checks where a real iPhone matters: the menu, footer links, the picture swipe
// and Add to cart. The full list runs in Playwright (see the project root).

import { site } from '../data/site.js';
import Store from '../pageobjects/StorePage.js';
import Product from '../pageobjects/ProductPage.js';

describe('JASY Everyday in Safari on the iOS Simulator', () => {
  before(async () => {
    await Store.unlockIfLocked();
  });

  it('SIM-01 (TC-01) the store opens in Safari', async () => {
    await Store.open('/');
    expect(await browser.getUrl()).not.toContain('/password');
    await expect(browser).toHaveTitle(expect.stringContaining('JASY'));
    await expect($('main')).toBeDisplayed();
  });

  it('SIM-02 (TC-03) the menu opens and closes with X', async () => {
    await Store.open('/');
    await Store.openMenu();
    await Store.closeMenuWithX();
  });

  it('SIM-03 (TC-04) menu categories open their pages', async () => {
    for (const category of [site.drawerCategories[0], site.drawerCategories[site.drawerCategories.length - 1]]) {
      await Store.open('/');
      await Store.openMenu();
      await Store.tapMenuLink(category.name);
      await Store.waitForUrlToContain(category.path);
    }
  });

  it('SIM-04 (TC-05 to TC-09) footer Helpful links open the right pages', async () => {
    await Store.open('/');
    expect(await Store.helpfulLinksHeadingDisplayed()).toBe(true);
    for (const link of site.helpfulLinks) {
      await Store.open('/');
      await Store.tapFooterLink(link.name);
      await Store.waitForUrlToContain(link.path);
    }
  });

  it('SIM-05 (TC-14) a finger swipe moves the product gallery', async () => {
    await Product.open();
    const result = await Product.swipeGalleryLeft();
    console.log('Gallery swipe moved ' + result.moved + 'px (' + result.how + ')');
    expect(result.moved).toBeGreaterThan(10);
  });

  it('SIM-06 (TC-15) Add to cart works in Safari', async () => {
    await Product.open();
    await Product.clearCart();
    await Product.tapAddToCart();
    await browser.waitUntil(async () => (await Product.cartCount()) === 1, {
      timeout: 20000,
      timeoutMsg: 'The cart did not get the product',
    });
    const idle = await browser.execute(() => typeof window.requestIdleCallback);
    console.log('requestIdleCallback in this Safari: ' + idle);
    await Product.clearCart();
  });
});
