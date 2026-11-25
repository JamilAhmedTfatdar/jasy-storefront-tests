const { test, expect } = require('@playwright/test');
const { getCart, hrefByText, openAvailableProduct, addFirstAvailableProductToCart, addProductToCartByApi } = require('./helpers/storefront');

// Safety rule for this file: tests may add items to the cart and OPEN checkout,
// but never type an email, address or card number and never place an order.

test.describe('Shopping', () => {
  test('SF-10 Product page shows image, price, quantity and Add to cart', async ({ page }) => {
    const add = await openAvailableProduct(page);
    await expect(add).toBeVisible();
    await expect(page.locator('main img').first()).toBeVisible();
    await expect(page.locator('main')).toContainText(/\$\s?\d/);
    await expect(page.locator('main input[name="quantity"]').first()).toBeVisible();
  });

  test('SF-13 Product image zoom opens and closes', async ({ page }) => {
    await openAvailableProduct(page);
    const zoom = page.getByRole('button', { name: /zoom media 1/i }).first();
    test.skip((await zoom.count()) === 0, 'No Zoom media button at this screen size (the phone gallery uses swipe)');
    await zoom.click();
    const close = page.getByRole('button', { name: /^close$/i }).first();
    await expect(close).toBeVisible();
    await close.click();
    await expect(close).toBeHidden();
  });

  test('SF-14 Add to cart puts one item in the cart', async ({ page }) => {
    await addFirstAvailableProductToCart(page);
    await expect.poll(async () => (await getCart(page)).item_count).toBe(1);
  });

  test('SF-15 Cart quantity updates', async ({ page }) => {
    await addProductToCartByApi(page);
    await page.goto('/cart');
    const qty = page.locator('input[name^="updates"]').first();
    await expect(qty).toBeVisible();
    await qty.fill('2');
    await qty.press('Tab');
    const update = page.getByRole('button', { name: /^update/i });
    if ((await update.count()) > 0 && (await update.first().isVisible())) {
      await update.first().click();
    }
    await expect.poll(async () => (await getCart(page)).item_count).toBe(2);
  });

  test('SF-16 Checkout opens (nothing is entered or paid)', async ({ page }) => {
    await addProductToCartByApi(page);
    await page.goto('/cart');
    await page.getByRole('button', { name: /check ?out/i }).first().click();
    await page.waitForURL(/\/checkouts?\//, { timeout: 30000 });
    await expect(page.getByLabel(/email/i).first()).toBeVisible({ timeout: 20000 });
  });

  test('SF-18 Account link reaches the sign-in page', async ({ page }) => {
    await page.goto('/account');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).not.toHaveTitle(/404|not found/i);
    await expect(page.getByLabel(/email/i).first()).toBeVisible({ timeout: 20000 });
  });

  test('SF-20 Back button returns to each page without a blank screen', async ({ page }) => {
    const visited = ['/'];
    await page.goto('/');
    for (const name of ['About Us', 'Contact Us']) {
      const href = await hrefByText(page, name);
      expect(href, `No "${name}" link found`).not.toBeNull();
      await page.goto(href);
      visited.push(new URL(page.url()).pathname);
    }
    for (let i = visited.length - 2; i >= 0; i--) {
      await page.goBack();
      await expect.poll(() => new URL(page.url()).pathname).toBe(visited[i]);
      await expect(page.locator('main')).toBeVisible();
      const textLength = await page.evaluate(() => document.body.innerText.length);
      expect(textLength, 'Page looks blank after going back').toBeGreaterThan(100);
    }
  });
});
