const { test, expect } = require('./helpers/fixtures');
const site = require('./data/site.json');
const {
  pathOf,
  brokenImages,
  openDrawer,
  closeDrawerWithX,
  closeDrawerWithBackdrop,
  tapDrawerLink,
  tapFooterLink,
} = require('./helpers/storefront');

// Tags in the test name decide where a test runs: @desktop only on the desktop project,
// @mobile only on the phone project, no tag means both.

test.describe('Store loading and navigation', () => {
  for (const [id, tag] of [['TC01', '@desktop'], ['TC02', '@mobile']]) test(`${id} Store loads without errors, broken images or a password page ${tag}`, async ({ page }) => {
    const response = await page.goto('/');
    expect(response.status()).toBeLessThan(400);
    expect(page.url(), 'The "Opening soon" password page is showing').not.toContain('/password');
    await expect(page).toHaveTitle(new RegExp(site.brand.split(' ')[0], 'i'));
    await expect(page.locator('main')).toBeVisible();
    expect(await brokenImages(page), 'Images that did not load').toEqual([]);
  });

  for (const link of site.desktopNav) {
    test(`TC06 Desktop header link "${link.name}" opens the right page @desktop`, async ({ page }) => {
      await page.goto('/');
      await page.locator('header').getByRole('link', { name: link.name, exact: true }).first().click();
      await page.waitForLoadState('domcontentloaded');
      await expect(page).not.toHaveTitle(/404|not found/i);
      await expect.poll(() => pathOf(page), { timeout: 15000 }).toBe(link.path);
    });
  }

  test('TC10 Phone menu opens and closes with X @mobile', async ({ page }) => {
    await page.goto('/');
    await openDrawer(page);
    await closeDrawerWithX(page);
  });

  test('TC10 Phone menu closes when the background is tapped @mobile', async ({ page }) => {
    await page.goto('/');
    await openDrawer(page);
    await closeDrawerWithBackdrop(page);
  });

  test('EX-02 Phone menu: Shop Essentials expands or opens its page @mobile', async ({ page }) => {
    await page.goto('/');
    await openDrawer(page);
    await tapDrawerLink(page, 'Shop Essentials');
    await page.waitForTimeout(1500);
    const opened = pathOf(page) === '/collections/shop-essentials';
    if (opened === false) {
      // It did not navigate, so it must have expanded and shown the category links.
      await expect(page.getByRole('link', { name: site.drawerCategories[0].name, exact: true }).first()).toBeVisible();
    }
  });

  for (const cat of site.drawerCategories) {
    test(`EX-03 Phone menu category "${cat.name}" opens its page @mobile`, async ({ page }) => {
      await page.goto('/');
      await openDrawer(page);
      await tapDrawerLink(page, cat.name);
      await page.waitForLoadState('domcontentloaded');
      await expect(page).not.toHaveTitle(/404|not found/i);
      await expect.poll(() => pathOf(page), { timeout: 15000 }).toBe(cat.path);
    });
  }

  for (const [id, tag] of [['TC12', '@desktop'], ['TC13', '@mobile']]) test(`${id} Footer shows the "Helpful links" heading ${tag}`, async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer').first();
    await footer.scrollIntoViewIfNeeded();
    await expect(footer.getByText(/helpful links/i).first()).toBeVisible();
  });

  for (const [id, tag] of [['TC12', '@desktop'], ['TC13', '@mobile']]) site.helpfulLinks.forEach((link) => {
    test(`${id} Footer Helpful links: "${link.name}" opens the right page ${tag}`, async ({ page }) => {
      await page.goto('/');
      await tapFooterLink(page, link.name);
      await page.waitForLoadState('domcontentloaded');
      await expect(page).not.toHaveTitle(/404|not found/i);
      await expect.poll(() => pathOf(page), { timeout: 15000 }).toBe(link.path);
    });
  });
});
