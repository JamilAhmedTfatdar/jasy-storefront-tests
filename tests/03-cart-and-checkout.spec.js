const { test, expect } = require('./helpers/fixtures');
const site = require('./data/site.json');
const { getCart, getJson, clearCart, addProductByApi, gotoProduct, findAddToCart, gotoSettled } = require('./helpers/storefront');

// Safety rule for this file: tests may add items to the cart and OPEN checkout,
// but never type an email, address or card number and never place an order.

test.describe('Cart and checkout', () => {
  test('TC28 and TC35 Add to cart puts the right product and price in the cart', async ({ page }) => {
    await clearCart(page);
    const data = await getJson(page, '/products/' + site.product.handle + '.js');
    const variant = data.variants.find((v) => v.available);
    expect(variant, 'The product has no available variant').toBeDefined();
    const price = (variant.price / 100).toFixed(2);
    await gotoProduct(page);
    await expect(page.locator('main')).toContainText('$' + price);
    const add = await findAddToCart(page);
    expect(add, 'No visible, enabled Add to cart button').not.toBeNull();
    await add.click({ timeout: 15000 });
    await expect.poll(async () => (await getCart(page)).item_count, { timeout: 20000 }).toBe(1);

    const cart = await getCart(page);
    expect(cart.items[0].product_title).toMatch(new RegExp(site.product.titleWords, 'i'));
    expect((cart.items[0].price / 100).toFixed(2)).toBe(price);

    // The cart count in the header, when the theme shows one.
    const bubble = page.locator('header [class*="cart-bubble"], header [class*="cart-count"]').first();
    if ((await bubble.count()) > 0) await expect(bubble).toContainText('1');

    await page.goto('/cart');
    await expect(page.locator('main')).toContainText(new RegExp(site.product.titleWords, 'i'));
    await expect(page.locator('main')).toContainText('$' + price);
  });

  test('TC36 and TC37 Cart quantity can be increased, decreased and removed', async ({ page }) => {
    await clearCart(page);
    await addProductByApi(page, site.product.handle);
    await gotoSettled(page, '/cart');
    const unit = (await getCart(page)).items[0].price;

    async function change(buttonName, inputValue) {
      const button = page.getByRole('button', { name: buttonName }).first();
      if ((await button.count()) > 0) {
        await button.click();
      } else {
        const qty = page.locator('input[name^="updates"]').first();
        await qty.fill(inputValue);
        await qty.press('Tab');
      }
    }

    await change(/increase quantity/i, '2');
    await expect.poll(async () => (await getCart(page)).item_count, { timeout: 20000 }).toBe(2);
    const two = await getCart(page);
    expect(two.items_subtotal_price, 'Subtotal after increasing').toBe(unit * 2);
    await gotoSettled(page, '/cart');

    await change(/decrease quantity/i, '1');
    await expect.poll(async () => (await getCart(page)).item_count, { timeout: 20000 }).toBe(1);
    const one = await getCart(page);
    expect(one.items_subtotal_price, 'Subtotal after decreasing').toBe(unit);
    await gotoSettled(page, '/cart');

    const remove = page.getByRole('button', { name: /^(remove|delete)\b/i }).or(page.getByRole('link', { name: /^(remove|delete)\b/i })).first();
    if ((await remove.count()) > 0) {
      await remove.click();
    } else {
      const qty = page.locator('input[name^="updates"]').first();
      await qty.fill('0');
      await qty.press('Tab');
    }
    await expect.poll(async () => (await getCart(page)).item_count, { timeout: 20000 }).toBe(0);
    await gotoSettled(page, '/cart');
    await expect(page.locator('main')).toContainText(/empty/i);
  });

  test('EX-14 Checkout opens securely (nothing is entered, nothing is paid)', async ({ page, baseURL }) => {
    await clearCart(page);
    await addProductByApi(page, site.product.handle);
    await page.goto('/cart');
    await page.getByRole('button', { name: /check ?out/i }).first().click();
    await page.waitForURL(/\/checkouts?\//, { timeout: 30000 });
    if (baseURL.indexOf('https:') === 0) expect(page.url(), 'Checkout is not on https').toMatch(/^https:/);
    await expect(page.getByLabel(/email/i).first()).toBeVisible({ timeout: 20000 });
    // The test stops here. Paying with the test card is a manual step (see TEST-CASES.md, TC-30).
  });
});
