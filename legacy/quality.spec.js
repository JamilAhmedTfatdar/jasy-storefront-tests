const { test, expect } = require('@playwright/test');
const { getStatus, openAvailableProduct, scrollThrough, sitePaths } = require('./helpers/storefront');

test.describe('Quality checks', () => {
  test('SF-11 Product images load and fit the screen', async ({ page }) => {
    await openAvailableProduct(page);
    await scrollThrough(page);
    const images = await page.locator('main img').evaluateAll((imgs) =>
      imgs.map((img) => {
        const r = img.getBoundingClientRect();
        let inScroller = false;
        for (let el = img.parentElement; el !== null && el !== document.body; el = el.parentElement) {
          const ox = getComputedStyle(el).overflowX;
          if ((ox === 'auto' || ox === 'scroll' || ox === 'hidden') && el.scrollWidth > el.clientWidth + 1) inScroller = true;
        }
        return {
          src: img.currentSrc || img.src,
          shown: r.width > 100 && r.height > 50,
          broken: img.complete && img.naturalWidth === 0,
          sticksOut: inScroller === false && r.left >= -1 && r.left < window.innerWidth && r.right > window.innerWidth + 1,
        };
      })
    );
    const shown = images.filter((i) => i.shown);
    expect(shown.length, 'No product images were found').toBeGreaterThan(0);
    expect(shown.filter((i) => i.broken).map((i) => i.src), 'Images that did not load').toEqual([]);
    expect(shown.filter((i) => i.sticksOut).map((i) => i.src), 'Images wider than the screen').toEqual([]);
  });

  test('SF-21 No horizontal overflow on main pages', async ({ page }) => {
    test.setTimeout(180000);
    const bad = [];
    for (const path of await sitePaths(page)) {
      await page.goto(path);
      const extra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (extra > 1) bad.push(path + ' (' + extra + 'px too wide)');
    }
    expect(bad, 'Pages that scroll sideways').toEqual([]);
  });

  test('SF-27 No broken links', async ({ page }) => {
    test.setTimeout(240000);
    const urls = new Set();
    let origin = '';
    for (const path of (await sitePaths(page)).slice(0, 12)) {
      await page.goto(path);
      origin = new URL(page.url()).origin;
      const hrefs = await page.locator('a[href]').evaluateAll((links) => links.map((a) => a.href));
      for (const h of hrefs) {
        const u = new URL(h);
        const skip = ['/account', '/checkout', '/cdn/', '/cart/', '/customer_authentication'].some((p) => u.pathname.indexOf(p) === 0);
        if (u.origin === origin && skip === false) urls.add(u.origin + u.pathname + u.search);
      }
    }
    const bad = [];
    for (const url of Array.from(urls).slice(0, 80)) {
      const status = await getStatus(page, url);
      if (status >= 400) bad.push(status + ' ' + url);
    }
    expect(bad, 'Links that returned an error').toEqual([]);
  });

  test('SF-28 No console errors, failed requests or missing images', async ({ page, baseURL }) => {
    test.setTimeout(240000);
    const host = new URL(baseURL).hostname;
    const problems = [];
    const checked = new Set();
    // Harmless messages: Shopify's own tracking calls and pages that were left while still loading.
    const noise = (text) => /sf_private_access_tokens|monorail-edge|access control checks|Load failed/i.test(text);
    let where = '';
    page.on('pageerror', (e) => {
      if (noise(e.message) === false) problems.push(where + ' JS error: ' + e.message);
    });
    page.on('console', (m) => {
      if (m.type() === 'error' && m.location().url.indexOf(host) > -1 && noise(m.text() + ' ' + m.location().url) === false) {
        problems.push(where + ' console error: ' + m.text());
      }
    });
    page.on('response', (r) => {
      if (r.status() >= 400 && r.url().indexOf(host) > -1 && noise(r.url()) === false) {
        problems.push(where + ' ' + r.status() + ' ' + r.url());
      }
    });
    for (const path of await sitePaths(page)) {
      where = path;
      await page.goto(path);
      await scrollThrough(page);
      const broken = await page.evaluate(() =>
        Array.from(document.images)
          .filter((img) => img.complete && img.naturalWidth === 0 && (img.currentSrc || img.src) !== '')
          .map((img) => img.currentSrc || img.src)
      );
      for (const src of broken) {
        if (checked.has(src)) continue;
        checked.add(src);
        const status = await getStatus(page, new URL(src, page.url()).href);
        if (status >= 400) problems.push(path + ' broken image (' + status + '): ' + src);
      }
    }
    expect(Array.from(new Set(problems)), 'Problems found').toEqual([]);
  });
});
