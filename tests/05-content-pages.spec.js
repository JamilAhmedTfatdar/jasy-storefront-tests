const { test, expect } = require('@playwright/test');
const site = require('./data/site.json');
const { getStatus, pathOf, horizontalOverflow, brokenImages } = require('./helpers/storefront');

test.describe('TC-21 to TC-25 Content pages, back button and footer', () => {
  test('TC-21 Contact page shows contact details and its links work', async ({ page }) => {
    await page.goto('/pages/contact');
    await expect(page).not.toHaveTitle(/404|not found/i);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    const main = page.locator('main');
    const html = await main.innerHTML();
    expect(html, 'The support email ' + site.supportEmail + ' is not on the Contact page').toContain(site.supportEmail);
    if ((await main.locator('form').count()) === 0) {
      test.info().annotations.push({ type: 'note', description: 'The Contact page has no form, only contact information.' });
    }
    const hrefs = await main.locator('a[href]').evaluateAll((els) => els.map((a) => a.href));
    const bad = [];
    for (const href of Array.from(new Set(hrefs))) {
      if (href.indexOf('http') !== 0) continue;
      const status = await getStatus(page, href);
      if (status >= 400) bad.push(status + ' ' + href);
    }
    expect(bad, 'Links on the Contact page that returned an error').toEqual([]);
  });

  test('TC-22 About Us page shows content and images and fits the screen', async ({ page }) => {
    await page.goto('/pages/about-us');
    await expect(page).not.toHaveTitle(/404|not found/i);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    const text = await page.locator('main').innerText();
    expect(text.length, 'Not much text on the About Us page').toBeGreaterThan(200);
    const shown = await page.locator('main img').and(page.locator(':visible')).count();
    if (shown === 0) test.info().annotations.push({ type: 'note', description: 'No picture is shown on the About Us page.' });
    expect(await brokenImages(page), 'Images that did not load').toEqual([]);
    expect(await horizontalOverflow(page), 'The page scrolls sideways').toBeLessThanOrEqual(1);
  });

  test('TC-23 Back button returns to the category page with its layout', async ({ page }) => {
    const start = site.collections[0].path;
    await page.goto(start);
    const product = page.locator('main a[href*="/products/"]').and(page.locator(':visible')).first();
    await expect(product).toBeVisible();
    // The card link is an empty overlay and the picture lies on top of it, so click where a shopper clicks.
    await product.click({ force: true });
    try {
      await page.waitForURL(/\/products\//, { timeout: 8000 });
    } catch (e) {
      await product.evaluate((el) => el.click());
      await page.waitForURL(/\/products\//);
      test.info().annotations.push({ type: 'note', description: 'Clicking the product picture did not open the product; the link itself had to be clicked.' });
    }
    await page.goBack();
    await expect.poll(() => pathOf(page)).toBe(start);
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('main a[href*="/products/"]').first()).toBeVisible();
    const textLength = await page.evaluate(() => document.body.innerText.length);
    expect(textLength, 'The page looks blank after going back').toBeGreaterThan(100);
    expect(await horizontalOverflow(page), 'The page scrolls sideways after going back').toBeLessThanOrEqual(1);
  });

  test('TC-25 Footer shows Helpful links, newsletter, policies and copyright', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer').first();
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toContainText(/helpful links/i);
    expect(await footer.locator('input[type="email"]').count(), 'No newsletter email field').toBeGreaterThan(0);
    expect(await footer.getByRole('button', { name: /sign up|subscribe/i }).count(), 'No newsletter sign-up button').toBeGreaterThan(0);
    for (const policy of site.policies) {
      expect(await footer.locator('a[href*="' + policy.path + '"]').count(), policy.name + ' link missing from the footer').toBeGreaterThan(0);
    }
    await expect(footer).toContainText(/©|copyright/i);
    await expect(footer).toContainText(new RegExp(site.brand.split(' ')[0], 'i'));
  });
});
