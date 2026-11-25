// Looks around the storefront and prints what is really on the pages, so the
// tests can be matched to the real theme. Opens a visible browser window.
// Usage: npm run discover
const { chromium, devices } = require('@playwright/test');
const fs = require('fs');
const { unlockIfLocked } = require('../tests/helpers/gate');

const base = process.env.BASE_URL || 'https://jasyeveryday.com';
const lines = [];
function say(text) {
  console.log(text);
  lines.push(text);
}

async function list(page, selector, label) {
  const items = await page.locator(selector).evaluateAll((els) =>
    els.map((el) => (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ') + '  ->  ' + (el.getAttribute('href') || el.tagName.toLowerCase()))
  );
  say('\n' + label + ' (' + items.length + ')');
  Array.from(new Set(items)).slice(0, 40).forEach((i) => say('  ' + i));
}

(async () => {
  fs.mkdirSync('discover', { recursive: true });
  const browser = await chromium.launch({ headless: false, slowMo: 400 });

  const desktop = await browser.newContext({ ...devices['Desktop Chrome'], baseURL: base });
  const page = await desktop.newPage();
  try {
    await unlockIfLocked(page);
  } catch (e) {
    say(e.message);
    await browser.close();
    process.exit(1);
  }

  say('PAGE: ' + (await page.title()) + '  ' + page.url());
  await page.screenshot({ path: 'discover/home-desktop.png', fullPage: true });
  await list(page, 'header a[href], header button, header summary', 'HEADER links and buttons');
  await list(page, 'footer a[href]', 'FOOTER links');
  await list(page, 'footer input, footer button', 'FOOTER form fields');

  await page.goto('/collections');
  await list(page, 'main a[href*="/collections/"]', 'COLLECTIONS');

  await page.goto('/collections/all');
  const product = await page.locator('a[href*="/products/"]').first().getAttribute('href');
  say('\nFIRST PRODUCT: ' + product);
  if (product) {
    await page.goto(product);
    await page.screenshot({ path: 'discover/product-desktop.png', fullPage: true });
    await list(page, 'main button', 'PRODUCT buttons');
    await list(page, 'main input', 'PRODUCT inputs');
    await list(page, 'main img', 'PRODUCT images');
  }

  await page.goto('/pages/contact-us').catch(() => {});
  await list(page, 'a[href^="mailto:"]', 'MAILTO links on ' + page.url());

  await page.goto('/cart');
  await list(page, 'main button, main input', 'CART buttons and inputs');

  const mobile = await browser.newContext({ ...devices['iPhone 13'], defaultBrowserType: undefined, baseURL: base, storageState: await desktop.storageState() });
  const phone = await mobile.newPage();
  await phone.goto('/');
  await phone.screenshot({ path: 'discover/home-phone.png', fullPage: true });
  await list(phone, 'header button, header summary', 'PHONE header buttons');

  fs.writeFileSync('discover/report.txt', lines.join('\n'));
  say('\nSaved: discover/report.txt and screenshots in the discover folder.');
  await browser.close();
})();
