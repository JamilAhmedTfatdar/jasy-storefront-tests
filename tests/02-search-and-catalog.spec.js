const { test, expect } = require('./helpers/fixtures');
const site = require('./data/site.json');
const { isMobile, brokenImages, gotoProduct, findAddToCart } = require('./helpers/storefront');

test.describe('Search, categories and product page', () => {
  test('TC07 Search shows relevant products', async ({ page }) => {
    await page.goto('/');
    const opener = page.locator('header').getByRole('button', { name: /search/i }).or(page.locator('header').getByRole('link', { name: /search/i })).first();
    await opener.click();
    let box = page.locator('input[type="search"], input[name="q"]').and(page.locator(':visible')).first();
    try {
      await expect(box).toBeVisible({ timeout: 4000 });
    } catch (e) {
      // The search box did not open from the icon; use the search page itself.
      await page.goto('/search');
      box = page.locator('input[type="search"], input[name="q"]').and(page.locator(':visible')).first();
      await expect(box, 'No search box found').toBeVisible();
    }
    await box.fill(site.product.searchKeyword);
    await box.press('Enter');
    await page.waitForURL(/\/search/, { timeout: 15000 });
    await expect(page).not.toHaveTitle(/404|not found/i);
    const results = page.locator('main a[href*="/products/"]');
    await expect(results.first(), 'No products appeared for "' + site.product.searchKeyword + '"').toBeVisible({ timeout: 15000 });
  });

  for (const [id, tag] of [['TC19', '@desktop'], ['TC20', '@mobile']]) for (const col of site.collections) {
    test(`${id} Category "${col.name}" shows title, products, images and prices ${tag}`, async ({ page }) => {
      await page.goto(col.path);
      await expect(page).not.toHaveTitle(/404|not found/i);
      const heading = page.getByRole('heading', { level: 1 }).first();
      await expect(heading).toContainText(col.name, { ignoreCase: true });
      const products = page.locator('main a[href*="/products/"]');
      const hasProducts = await products.first().waitFor({ state: 'attached', timeout: 8000 }).then(() => true, () => false);
      if (hasProducts === false) {
        await expect(page.locator('main'), 'No products and no "coming soon" message on this page').toContainText(/coming soon|no products/i);
        test.info().annotations.push({ type: 'note', description: col.name + ' has no products yet (it shows a coming-soon message).' });
        return;
      }
      await expect(products.first(), 'No products on this page').toBeVisible();
      await expect(page.locator('main')).toContainText(/\$\s?\d/);
      expect(await brokenImages(page), 'Images that did not load').toEqual([]);
    });
  }

  test('TC19 Category pages show filters @desktop', async ({ page }) => {
    const without = [];
    for (const col of site.collections) {
      await page.goto(col.path);
      const filters = page
        .getByRole('button', { name: /filter/i })
        .or(page.getByText(/^\s*filter/i))
        .or(page.locator('[class*="facets"], form[id*="filter" i], details[class*="filter" i]'));
      if ((await filters.count()) === 0) without.push(col.name);
    }
    expect(without, 'Category pages with no filter control found').toEqual([]);
  });

  for (const [id, tag] of [['TC22', '@desktop'], ['TC23', '@mobile']]) test(`${id} Secondary product page shows title, price, description, images, quantity and Add to cart ${tag}`, async ({ page }) => {
    await gotoProduct(page);
    await expect(page).not.toHaveTitle(/404|not found/i);
    await expect(page.getByRole('heading', { level: 1 }).first()).toContainText(new RegExp(site.product.titleWords, 'i'));
    await expect(page.locator('main')).toContainText(/\$\s?\d/);
    const text = await page.locator('main').innerText();
    expect(text.length, 'Not much description text on the product page').toBeGreaterThan(200);
    await expect(page.locator('main img').and(page.locator(':visible')).first()).toBeVisible();
    await expect(page.locator('main input[name="quantity"]').first()).toBeVisible();
    const add = await findAddToCart(page);
    expect(add, 'No visible, enabled Add to cart button').not.toBeNull();
    expect(await brokenImages(page), 'Images that did not load').toEqual([]);
  });

  for (const [id, tag] of [['TC24', '@desktop'], ['TC25', '@mobile']]) test(`${id} Product gallery images fit the screen ${tag}`, async ({ page }) => {
    await gotoProduct(page);
    const view = page.viewportSize();
    if (isMobile(page)) {
      // The phone gallery has no zoom button; check the main picture fits the screen.
      const img = page.locator('main img').and(page.locator(':visible')).first();
      await expect(img).toBeVisible();
      const box = await img.boundingBox();
      expect(box.width, 'Picture is wider than the screen').toBeLessThanOrEqual(view.width + 1);
      expect(box.x, 'Picture starts off the left edge').toBeGreaterThanOrEqual(-1);
      return;
    }
    await page.getByRole('button', { name: /zoom media 1/i }).first().click();
    const close = page.getByRole('button', { name: /^close$/i }).first();
    await expect(close).toBeVisible();
    const zoomed = page.locator('dialog img, [role="dialog"] img, zoom-dialog img').and(page.locator(':visible')).first();
    await expect(zoomed, 'No enlarged picture found').toBeVisible();
    const box = await zoomed.boundingBox();
    expect(box.width, 'Enlarged picture is wider than the screen').toBeLessThanOrEqual(view.width + 1);
    await close.click();
    await expect(close).toBeHidden();
  });

  // A real finger swipe cannot be sent to the phone browser, so this scrolls the gallery sideways
  // by one picture, which is what a swipe does, and checks the page itself does not move.
  test('TC25 Phone gallery moves between pictures (scroll stands in for the swipe) @mobile', async ({ page }) => {
    await gotoProduct(page);
    const result = await page.evaluate(async () => {
      const imgs = Array.from(document.querySelectorAll('main img')).filter((i) => {
        const r = i.getBoundingClientRect();
        return r.width > 100 && r.height > 100;
      });
      for (const img of imgs) {
        for (let el = img.parentElement; el !== null && el !== document.body; el = el.parentElement) {
          const ox = getComputedStyle(el).overflowX;
          if ((ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth + 1) {
            const y0 = window.scrollY;
            const x0 = el.scrollLeft;
            el.scrollTo({ left: x0 + el.clientWidth, behavior: 'instant' });
            await new Promise((r) => setTimeout(r, 800));
            const x1 = el.scrollLeft;
            el.scrollTo({ left: x0, behavior: 'instant' });
            await new Promise((r) => setTimeout(r, 800));
            return { found: true, moved: x1 - x0, back: el.scrollLeft - x0, pageMoved: window.scrollY - y0 };
          }
        }
      }
      return { found: false };
    });
    expect(result.found, 'No sideways-scrolling picture gallery was found on the phone product page').toBe(true);
    expect(result.moved, 'The gallery did not move to the next picture').toBeGreaterThan(10);
    expect(Math.abs(result.back), 'The gallery did not come back').toBeLessThan(5);
    expect(Math.abs(result.pageMoved), 'The page scrolled up or down while the gallery moved').toBeLessThan(5);
  });
});
