const { test, expect } = require('@playwright/test');
const site = require('./data/site.json');
const { getStatus, horizontalOverflow, watchProblems, collectLinks } = require('./helpers/storefront');

const productPath = '/products/' + site.product.handle;
const keyPages = ['/', ...site.collections.map((c) => c.path), productPath, '/pages/about-us', '/pages/contact', '/search', '/cart'];

test.describe('TC-24 to TC-28 Layout, links, speed and accessibility', () => {
  test('TC-24 Layout at 390, 768, 1024 and 1440 px has no sideways scroll or overlapping header controls @desktop', async ({ page }) => {
    test.setTimeout(300000);
    const problems = [];
    for (const width of [390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ['/', site.collections[0].path, productPath, '/pages/contact']) {
        await page.goto(path);
        const extra = await horizontalOverflow(page);
        if (extra > 1) problems.push(width + 'px ' + path + ': page is ' + extra + 'px too wide');
        const overlaps = await page.evaluate(() => {
          const items = Array.from(document.querySelectorAll('header a, header button, header summary'))
            .map((el) => ({ el, r: el.getBoundingClientRect(), s: getComputedStyle(el) }))
            .filter((i) => i.r.width > 0 && i.r.height > 0 && i.s.visibility !== 'hidden' && i.r.right > 0 && i.r.left < window.innerWidth);
          const found = [];
          for (let a = 0; a < items.length; a++) {
            for (let b = a + 1; b < items.length; b++) {
              const x = items[a];
              const y = items[b];
              if (x.el.contains(y.el) || y.el.contains(x.el)) continue;
              if (x.el.closest('li') !== null && x.el.closest('li') === y.el.closest('li')) continue;
              const w = Math.min(x.r.right, y.r.right) - Math.max(x.r.left, y.r.left);
              const h = Math.min(x.r.bottom, y.r.bottom) - Math.max(x.r.top, y.r.top);
              if (w > 8 && h > 8) {
                const name = (el) => (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 20);
                found.push('"' + name(x.el) + '" overlaps "' + name(y.el) + '" (' + Math.round(w) + 'x' + Math.round(h) + 'px)');
              }
            }
          }
          return found;
        });
        for (const o of overlaps) problems.push(width + 'px ' + path + ': ' + o);
      }
    }
    expect(problems, 'Layout problems').toEqual([]);
  });

  test('TC-26 No broken links on header, menu, footer, category and product pages', async ({ page }) => {
    test.setTimeout(480000);
    const urls = await collectLinks(page, keyPages);
    const bad = [];
    for (const url of urls.slice(0, 150)) {
      const status = await getStatus(page, url);
      if (status >= 400) bad.push(status + ' ' + url);
    }
    expect(bad, 'Links that returned an error').toEqual([]);
  });

  for (const [name, path] of [['Home page', '/'], ['Product page', productPath]]) {
    test(`TC-27 ${name} loads promptly with no blocking errors`, async ({ page, baseURL }) => {
      const budget = Number(process.env.PERF_MS || 5000);
      const problems = watchProblems(page, baseURL);
      await page.goto(path);
      let started = Date.now();
      let reloaded = await page.reload({ waitUntil: 'domcontentloaded' });
      // Shopify answers 429 when asked too fast; wait and ask again (up to three times).
      for (let attempt = 0; attempt < 3 && reloaded !== null && reloaded.status() === 429; attempt++) {
        await page.waitForTimeout(3000);
        started = Date.now();
        reloaded = await page.reload({ waitUntil: 'domcontentloaded' });
      }
      if (reloaded !== null) expect(reloaded.status(), 'The page answered with an error when it was reloaded').toBeLessThan(400);
      await expect(page.locator('main'), 'No main content after the reload (page title: ' + (await page.title()) + ')').toBeVisible({ timeout: budget });
      const ms = Date.now() - started;
      expect(ms, 'Main content took too long to appear (ms)').toBeLessThan(budget);
      const lcp = await page.evaluate(
        () =>
          new Promise((resolve) => {
            try {
              new PerformanceObserver((list) => {
                const entries = list.getEntries();
                resolve(Math.round(entries[entries.length - 1].startTime));
              }).observe({ type: 'largest-contentful-paint', buffered: true });
              setTimeout(() => resolve(null), 3000);
            } catch (e) {
              resolve(null);
            }
          })
      );
      if (lcp !== null) expect(lcp, 'Largest content took too long to show (ms)').toBeLessThan(4000);
      await page.waitForTimeout(1500);
      expect(Array.from(new Set(problems)), 'Errors while loading').toEqual([]);
    });
  }

  test('TC-28 Keyboard: every Tab stop shows where the focus is @desktop', async ({ page }) => {
    await page.goto('/');
    const seen = new Set();
    const lacking = [];
    const unchecked = [];
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        let el = document.activeElement;
        if (el === null || el === document.body) return null;
        while (el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
        const s = getComputedStyle(el);
        const outline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0;
        const shadow = s.boxShadow !== 'none';
        const name = el.tagName.toLowerCase() + ' "' + (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30) + '"';
        return { name, visible: outline || shadow, custom: el.tagName.indexOf('-') > -1 };
      });
      if (info === null) continue;
      seen.add(info.name);
      if (info.visible === false && info.custom) unchecked.push(info.name);
      else if (info.visible === false) lacking.push(info.name);
    }
    expect(seen.size, 'The Tab key did not move through the page').toBeGreaterThan(4);
    if (unchecked.length > 0) test.info().annotations.push({ type: 'note', description: 'Could not check the focus outline inside: ' + unchecked.join(', ') + ' (check by hand)' });
    expect(lacking, 'Elements with no visible focus outline').toEqual([]);
  });

  test('TC-28 Text is readable (nothing tiny) on the home and product pages', async ({ page }) => {
    const min = Number(process.env.TEXT_MIN_PX || 12);
    const tiny = [];
    for (const path of ['/', productPath]) {
      await page.goto(path);
      const found = await page.evaluate((limit) => {
        const out = [];
        for (const el of Array.from(document.querySelectorAll('main p, main li, main a, main span, footer a, footer p, header a'))) {
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          const own = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim() !== '');
          if (own === false || r.width === 0 || r.height === 0 || s.visibility === 'hidden') continue;
          if (parseFloat(s.fontSize) < limit) out.push('"' + el.textContent.trim().slice(0, 30) + '" is ' + s.fontSize);
        }
        return out.slice(0, 8);
      }, min);
      for (const f of found) tiny.push(path + ' ' + f);
    }
    expect(tiny, 'Text smaller than ' + min + 'px').toEqual([]);
  });

  // WCAG 2.2 minimum tap size is 24 by 24 px, unless there is enough space around a smaller target.
  test('TC-28 Phone tap targets are big enough or well spaced @mobile', async ({ page }) => {
    const min = Number(process.env.TAP_MIN_PX || 24);
    const small = [];
    for (const path of ['/', productPath]) {
      await page.goto(path);
      const found = await page.evaluate((limit) => {
        const all = Array.from(document.querySelectorAll('header a, header button, header summary, main a, main button, footer a, footer button'))
          .filter((el) => el.closest('p') === null)
          .map((el) => ({ el, r: el.getBoundingClientRect(), s: getComputedStyle(el) }))
          .filter((i) => i.r.width > 0 && i.r.height > 0 && i.s.visibility !== 'hidden' && i.r.right > 0 && i.r.left < window.innerWidth);
        const out = [];
        for (const t of all) {
          if (t.r.width >= limit && t.r.height >= limit) continue;
          const cx = t.r.left + t.r.width / 2;
          const cy = t.r.top + t.r.height / 2;
          const half = limit / 2;
          const crowded = all.some((o) => {
            if (o === t || o.el.contains(t.el) || t.el.contains(o.el)) return false;
            return o.r.left < cx + half && o.r.right > cx - half && o.r.top < cy + half && o.r.bottom > cy - half;
          });
          if (crowded) {
            const name = (t.el.getAttribute('aria-label') || t.el.textContent || t.el.tagName).trim().slice(0, 25);
            out.push('"' + name + '" is ' + Math.round(t.r.width) + 'x' + Math.round(t.r.height));
          }
        }
        return out.slice(0, 10);
      }, min);
      for (const f of found) small.push(path + ' ' + f);
    }
    expect(small, 'Tap targets smaller than ' + min + 'px with no space around them').toEqual([]);
  });

  // Extra check kept from the first version: the store once showed a personal Gmail address.
  test('EX-01 No Gmail address on customer-facing pages', async ({ page }) => {
    const offenders = [];
    const paths = ['/', '/pages/about-us', '/pages/contact', '/policies/contact-information', ...site.policies.map((p) => p.path)];
    for (const path of paths) {
      let html = '';
      for (let attempt = 0; attempt < 4; attempt++) {
        const res = await page.request.get(path);
        if (res.status() !== 429) {
          html = await res.text();
          break;
        }
        await page.waitForTimeout(2000 * (attempt + 1));
      }
      if (html.search(/@gmail\.com/i) > -1) offenders.push(path);
    }
    expect(offenders, 'Pages that mention @gmail.com').toEqual([]);
  });
});
