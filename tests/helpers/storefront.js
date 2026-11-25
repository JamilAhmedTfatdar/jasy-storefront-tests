const { expect } = require('@playwright/test');
const site = require('../data/site.json');

// Phones are narrower than this; the theme switches to the hamburger menu there.
function isMobile(page) {
  return page.viewportSize().width < 750;
}

// Shopify keeps the cart as JSON at /cart.js. Reading it is the most reliable
// way to check what is really in the cart.
async function getCart(page) {
  let last = '';
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await page.request.get('/cart.js');
    const type = res.headers()['content-type'] || '';
    const body = await res.text();
    if (res.status() === 200) {
      try {
        return JSON.parse(body);
      } catch (e) {
        // not cart data (for example a web page while Shopify throttles); wait and try again
      }
    }
    last = 'status ' + res.status() + ', type ' + type + ', starts with ' + body.slice(0, 40).replace(/\s+/g, ' ');
    await page.waitForTimeout(1500 * (attempt + 1));
  }
  throw new Error('/cart.js did not return cart data (' + last + ')');
}

// Reads JSON from the store. Shopify can answer with a web page while it throttles, so wait and retry.
async function getJson(page, url) {
  let last = '';
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await page.request.get(url);
    const body = await res.text();
    if (res.status() === 200) {
      try {
        return JSON.parse(body);
      } catch (e) {
        // not JSON; wait and try again
      }
    }
    last = 'status ' + res.status() + ', starts with ' + body.slice(0, 40).replace(/\s+/g, ' ');
    await page.waitForTimeout(1500 * (attempt + 1));
  }
  throw new Error(url + ' did not return data (' + last + ')');
}

// GET a page and return its status. Shopify answers 429 when asked too fast, so wait and retry.
async function getStatus(page, url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await page.request.get(url);
    if (res.status() !== 429) return res.status();
    await page.waitForTimeout(2000 * (attempt + 1));
  }
  return 429;
}

// Empties the cart (Shopify Ajax API) so every cart test starts from zero.
async function clearCart(page) {
  await page.request.post('/cart/clear.js');
}

// Puts one of the named product in the cart through Shopify's cart API (fast setup).
async function addProductByApi(page, handle) {
  const product = await getJson(page, '/products/' + handle + '.js');
  const variant = product.variants.find((v) => v.available);
  expect(variant, 'No available variant for ' + handle).toBeDefined();
  await page.request.post('/cart/add.js', { data: { id: variant.id, quantity: 1 } });
  return product;
}

// page.goto that survives a page reload still running from the last click
// (errors like ERR_ABORTED or "interrupted by another navigation").
async function gotoSettled(page, path) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto(path);
      return;
    } catch (e) {
      const message = String(e.message);
      const retryable = message.indexOf('ERR_ABORTED') > -1 || message.indexOf('interrupted by another navigation') > -1;
      if (retryable === false || attempt === 2) throw e;
      await page.waitForTimeout(800);
    }
  }
}

function pathOf(page) {
  return new URL(page.url()).pathname;
}

// How many pixels the page is wider than the screen (0 means no sideways scroll).
async function horizontalOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

// Scrolls down the page slowly so lazy-loaded images start loading.
async function scrollThrough(page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    window.scrollTo(0, 0);
  });
}

// Images that the page could not show. The page says "looks broken", then each one
// is checked with a real request so images that are only slow do not count.
async function brokenImages(page) {
  await scrollThrough(page);
  const srcs = await page.evaluate(() =>
    Array.from(document.images)
      .filter((i) => i.complete && i.naturalWidth === 0 && (i.currentSrc || i.src) !== '')
      .map((i) => i.currentSrc || i.src)
  );
  const bad = [];
  for (const src of Array.from(new Set(srcs))) {
    if (src.indexOf('data:') === 0) continue;
    const status = await getStatus(page, new URL(src, page.url()).href);
    if (status >= 400) bad.push(status + ' ' + src);
  }
  return bad;
}

// ---------- the phone menu (drawer) ----------

function drawerClose(page) {
  return page.getByRole('button', { name: /^close$/i }).first();
}

async function openDrawer(page) {
  const menu = page
    .locator('button[aria-label*="menu" i], summary[aria-label*="menu" i], [role="button"][aria-label*="menu" i], header summary')
    .and(page.locator(':visible'))
    .first();
  await menu.click();
  await expect(drawerClose(page), 'The menu did not open').toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(800);
}

async function closeDrawerWithX(page) {
  await drawerClose(page).click();
  await expect(drawerClose(page), 'The menu did not close with X').toBeHidden({ timeout: 8000 });
}

// Taps the dark strip beside the menu panel, as a shopper would to dismiss the menu.
async function closeDrawerWithBackdrop(page) {
  const view = page.viewportSize();
  await page.mouse.click(view.width - 6, Math.round(view.height / 2));
  await expect(drawerClose(page), 'The menu did not close when the background was tapped').toBeHidden({ timeout: 8000 });
}

// ---------- tapping like a shopper ----------

// Taps the first link in this list that is really on top: on screen and not covered by
// the menu or anything else. When none can be tapped, the error says what covers them.
async function tapLink(page, links, label) {
  const count = await links.count();
  const report = [];
  for (let i = 0; i < count; i++) {
    const link = links.nth(i);
    try {
      await link.scrollIntoViewIfNeeded({ timeout: 2000 });
    } catch (e) {
      // not scrollable; the check below decides
    }
    const info = await link.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const inside = r.width > 0 && r.height > 0 && x >= 0 && y >= 0 && x <= window.innerWidth && y <= window.innerHeight;
      const top = inside ? document.elementFromPoint(x, y) : null;
      const tappable = top !== null && (el === top || el.contains(top));
      const cover = top === null ? 'off screen' : top.tagName.toLowerCase() + '.' + String(top.className).split(' ')[0];
      return { tappable, cover, where: Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) };
    });
    if (info.tappable) {
      await link.click();
      return;
    }
    report.push('link ' + (i + 1) + ' at ' + info.where + ' is covered by ' + info.cover);
  }
  throw new Error('Nothing to tap for "' + label + '". Links with that name: ' + count + (count > 0 ? ' (' + report.join('; ') + ')' : ''));
}

// Phone menu: taps a link inside the open menu (opens a collapsed submenu first if needed).
async function tapDrawerLink(page, name) {
  const links = page.getByRole('link', { name, exact: true });
  try {
    await tapLink(page, links, name + ' (menu)');
    return;
  } catch (e) {
    // it may sit inside a collapsed submenu
  }
  const toggles = page.getByRole('button', { name: /submenu/i });
  const n = await toggles.count();
  for (let i = 0; i < n; i++) {
    try {
      await toggles.nth(i).click({ timeout: 2000 });
    } catch (e) {
      // not clickable; try the next one
    }
  }
  await page.waitForTimeout(500);
  await tapLink(page, links, name + ' (menu)');
}

// Footer "Helpful links": scrolls to the footer, opens the section if it is collapsed, taps the link.
async function tapFooterLink(page, name) {
  const footer = page.locator('footer').first();
  await footer.scrollIntoViewIfNeeded();
  const links = footer.getByRole('link', { name, exact: true });
  let shown = false;
  if ((await links.count()) > 0) shown = await links.first().isVisible();
  if (shown === false) {
    const heading = footer.getByText(/helpful links/i).first();
    if ((await heading.count()) > 0) {
      await heading.click();
      await page.waitForTimeout(600);
    }
  }
  await tapLink(page, links, name + ' (footer)');
}

// ---------- product page ----------

async function gotoProduct(page) {
  await page.goto('/products/' + site.product.handle);
}

// The page can hold several "Add to cart" buttons (for example a hidden sticky copy).
// Pick the one a shopper can really see and click: inside the screen after scrolling to it.
async function findAddToCart(page) {
  const all = page.getByRole('button', { name: /add to cart/i });
  const count = await all.count();
  let fallback = null;
  for (let i = 0; i < count; i++) {
    const btn = all.nth(i);
    if ((await btn.isVisible()) === false || (await btn.isEnabled()) === false) continue;
    if (fallback === null) fallback = btn;
    try {
      await btn.scrollIntoViewIfNeeded({ timeout: 2000 });
    } catch (e) {
      continue;
    }
    const box = await btn.boundingBox();
    const view = page.viewportSize();
    if (box === null || view === null) continue;
    const inside = box.x >= 0 && box.y >= 0 && box.x + box.width <= view.width + 1 && box.y + box.height <= view.height + 1;
    if (inside) return btn;
  }
  return fallback;
}

// ---------- console and network problems ----------

// Starts listening for JavaScript errors, console errors and failed requests on this site.
// Returns the list that fills up while pages load. Harmless Shopify tracking noise is ignored.
function watchProblems(page, baseURL) {
  const host = new URL(baseURL).hostname;
  const problems = [];
  const noise = (text) => /sf_private_access_tokens|monorail-edge|access control checks|Load failed/i.test(text);
  page.on('pageerror', (e) => {
    if (noise(e.message) === false) problems.push('JS error: ' + e.message);
  });
  page.on('console', (m) => {
    if (m.type() === 'error' && m.location().url.indexOf(host) > -1 && noise(m.text() + ' ' + m.location().url) === false) {
      problems.push('console error: ' + m.text());
    }
  });
  page.on('response', (r) => {
    if (r.status() >= 400 && r.url().indexOf(host) > -1 && noise(r.url()) === false) {
      problems.push(r.status() + ' ' + r.url());
    }
  });
  return problems;
}

// Same-site link addresses found on these pages (account, checkout and cart actions are skipped).
async function collectLinks(page, paths) {
  const urls = new Set();
  let origin = '';
  for (const p of paths) {
    await page.goto(p);
    origin = new URL(page.url()).origin;
    const hrefs = await page.locator('a[href]').evaluateAll((els) => els.map((a) => a.href));
    for (const h of hrefs) {
      let u;
      try {
        u = new URL(h);
      } catch (e) {
        continue;
      }
      if (u.protocol.indexOf('http') !== 0 || u.origin !== origin) continue;
      const skip = ['/account', '/checkout', '/cdn/', '/cart/', '/customer_authentication', '/password'].some((s) => u.pathname.indexOf(s) === 0);
      if (skip === false) urls.add(u.origin + u.pathname + u.search);
    }
  }
  return Array.from(urls);
}

module.exports = {
  isMobile,
  getCart,
  getJson,
  getStatus,
  clearCart,
  addProductByApi,
  gotoSettled,
  pathOf,
  horizontalOverflow,
  scrollThrough,
  brokenImages,
  drawerClose,
  openDrawer,
  closeDrawerWithX,
  closeDrawerWithBackdrop,
  tapLink,
  tapDrawerLink,
  tapFooterLink,
  gotoProduct,
  findAddToCart,
  watchProblems,
  collectLinks,
};
