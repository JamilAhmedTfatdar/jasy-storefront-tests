// Test plan cases that have no older test: TC03, TC04, TC05, TC09, TC11, TC14 to TC18, TC21, TC26, TC27,
// TC29 to TC32, TC38, TC39, TC41, TC49 to TC52 and TC53 to TC56. IDs follow ../TEST-CASES.md.
// Tags in the test name decide where a test runs: @desktop only on the desktop project,
// @mobile only on the phone project, no tag means both.
// Nothing here pays, sends a chat message or writes a review. Guarded cases need CHECKOUT_TEST=1 or CHAT_SEND=1.
const { test, expect } = require('./helpers/fixtures');
const site = require('./data/site.json');
const brush = require('./helpers/brush');
const {
  isMobile,
  pathOf,
  getCart,
  clearCart,
  addProductByApi,
  gotoSettled,
  findAddToCart,
  horizontalOverflow,
  brokenImages,
  openDrawer,
} = require('./helpers/storefront');

const productPath = '/products/' + site.product.handle;
const visible = (page) => page.locator(':visible');
const must = (condition, message) => expect(condition, message).toBeTruthy();

// ---------- TC03 and TC04: breakpoints ----------

for (const [w, h] of [[1440, 900], [1280, 800]]) {
  test(`TC03 Desktop layout at ${w}x${h} is readable with no sideways scroll @desktop`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    const problems = [];
    for (const path of ['/', site.collections[0].path, productPath, '/pages/contact']) {
      await gotoSettled(page, path);
      await expect(page.locator('main')).toBeVisible();
      const extra = await horizontalOverflow(page);
      if (extra > 1) problems.push(path + ': page is ' + extra + 'px too wide');
      const text = await page.locator('main').innerText();
      if (text.trim().length < 20) problems.push(path + ': almost no text');
    }
    expect(problems, 'Layout problems at ' + w + 'x' + h).toEqual([]);
  });
}

for (const [w, h] of [[390, 844], [430, 932]]) {
  test(`TC04 Phone layout at ${w}x${h} has no clipped text, overlap or sideways scroll @mobile`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    const problems = [];
    for (const path of ['/', site.collections[0].path, productPath, '/cart', '/pages/about-us']) {
      await gotoSettled(page, path);
      const extra = await horizontalOverflow(page);
      if (extra > 1) problems.push(path + ': page is ' + extra + 'px too wide');
      const clipped = await page.evaluate(() =>
        Array.from(document.querySelectorAll('h1, h2, h3, p, a, button'))
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && r.right > window.innerWidth + 1 && getComputedStyle(el).position !== 'fixed';
          })
          .slice(0, 3)
          .map((el) => el.tagName.toLowerCase() + ' "' + (el.innerText || '').trim().slice(0, 30) + '"')
      );
      if (clipped.length > 0) problems.push(path + ': runs off the right edge: ' + clipped.join(', '));
    }
    expect(problems, 'Layout problems at ' + w + 'x' + h).toEqual([]);
  });
}

// ---------- TC05, TC09: header ----------

test('TC05 Header logo returns to the home page', async ({ page }) => {
  await page.goto('/pages/about-us');
  await page.locator('header a.header-logo, header a[href="/"]').and(visible(page)).first().click();
  await page.waitForLoadState('domcontentloaded');
  await expect.poll(() => pathOf(page), { timeout: 15000 }).toBe('/');
  expect(page.url(), 'The logo sent the browser to the password page').not.toContain('/password');
});

test('TC09 Header cart icon shows the empty-cart state', async ({ page }) => {
  await page.goto('/');
  await clearCart(page);
  await page.goto('/');
  await page.locator('header a[href="/cart"], header [aria-label^="Cart" i]').and(visible(page)).first().click();
  await expect(page.getByText(/your cart is empty/i).first()).toBeVisible({ timeout: 15000 });
});

// ---------- TC11: phone menu links ----------

test('TC11 Phone menu links Home, Shop Essentials, About Us and Contact Us each open the right page @mobile', async ({ page }) => {
  const stops = site.desktopNav;
  const missing = [];
  for (const stop of stops) {
    await gotoSettled(page, '/collections/all');
    await openDrawer(page);
    const link = page.locator('a[id^="HeaderDrawer-"], .menu-drawer a, header-drawer a').filter({ hasText: new RegExp('^\\s*' + stop.name + '\\s*$', 'i') }).first();
    const shown = (await link.count()) > 0 && (await link.isVisible());
    if (shown === false) {
      test.info().annotations.push({ type: 'finding', description: 'The phone menu does not show ' + stop.name });
      missing.push(stop.name);
      continue;
    }
    await link.click();
    await page.waitForTimeout(1500);
    if (pathOf(page) !== stop.path) {
      // A menu entry with sub-links may open a sub-menu first.
      const expanded = await page.getByRole('link', { name: site.drawerCategories[0].name, exact: true }).first().isVisible();
      expect(expanded, stop.name + ' opened ' + pathOf(page) + ', expected ' + stop.path).toBe(true);
    }
  }
  expect(missing, 'FINDING: these links are not visible in the phone menu (the other links work)').toEqual([]);
});

// ---------- TC14: policies ----------

test('TC14 Footer policy links open readable policy pages', async ({ page }) => {
  for (const policy of site.policies) {
    await gotoSettled(page, '/');
    const footer = page.locator('footer').first();
    await footer.scrollIntoViewIfNeeded();
    const trigger = footer.locator('button.policy-list-trigger');
    if ((await trigger.count()) > 0) {
      await trigger.first().click();
      await page.waitForTimeout(600);
    }
    await footer.getByRole('link', { name: policy.name, exact: true }).first().click();
    await page.waitForURL((u) => u.pathname.includes(policy.path), { timeout: 15000 });
    await expect(page.getByRole('heading', { level: 1 }).first(), policy.name + ' has no heading').toBeVisible();
    const text = await page.locator('main').innerText();
    expect(text.length, policy.name + ' shows almost no text').toBeGreaterThan(400);
    expect(text, policy.name + ' shows a not-found page').not.toMatch(/page not found|404/i);
  }
});

// ---------- TC15 to TC18: home page ----------

async function heroInfo(page) {
  return page.evaluate((buttonCss) => {
    const num = (r) => ({ left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), height: Math.round(r.height) });
    const h1 = Array.from(document.querySelectorAll('h1')).find((h) => h.getBoundingClientRect().width > 10) || document.querySelector('h1');
    const cta = document.querySelector(buttonCss);
    const images = Array.from(document.querySelectorAll('main img'))
      .map((i) => ({ r: i.getBoundingClientRect(), ok: i.complete && i.naturalWidth > 0 }))
      .filter((x) => x.r.width > 150 && x.r.top < window.innerHeight);
    return {
      screenW: window.innerWidth,
      headline: h1 ? h1.innerText.replace(/\s+/g, ' ').trim() : '',
      headlineClipped: h1 ? h1.scrollWidth > h1.clientWidth + 1 : false,
      cta: cta ? { text: cta.innerText.trim(), ...num(cta.getBoundingClientRect()) } : null,
      images: images.map((x) => ({ ...num(x.r), ok: x.ok })),
    };
  }, 'a.jasy-hero__button');
}

async function checkHero(page, { tap }) {
  await gotoSettled(page, '/');
  await page.waitForTimeout(800);
  let hero = await heroInfo(page);
  for (let n = 0; n < 6 && !hero.images.every((i) => i.ok); n++) {
    await page.waitForTimeout(1500);
    hero = await heroInfo(page);
  }
  expect(hero.headline.toLowerCase(), 'Hero headline is "' + hero.headline + '"').toContain(site.hero.headline.toLowerCase());
  expect(hero.headlineClipped, 'The hero headline is cut off').toBe(false);
  expect(hero.cta, 'No hero button (a.jasy-hero__button)').not.toBeNull();
  expect(hero.cta.text, 'Hero button says "' + hero.cta.text + '"').toMatch(new RegExp(site.hero.cta, 'i'));
  expect(hero.images.length, 'No hero image').toBeGreaterThan(0);
  expect(hero.images.every((i) => i.ok), 'A hero image did not load').toBe(true);
  expect(hero.images.every((i) => i.left >= -1 && i.right <= hero.screenW + 1), 'A hero image runs off the screen').toBe(true);
  if (tap) expect(hero.cta.height, 'The hero button is only ' + hero.cta.height + 'px tall').toBeGreaterThanOrEqual(40);
  expect(await horizontalOverflow(page), 'The home page scrolls sideways').toBeLessThanOrEqual(1);
}

test('TC15 Home hero shows headline, image and a working Shop Essentials button @desktop', async ({ page }) => {
  await checkHero(page, { tap: false });
  await page.locator('a.jasy-hero__button').first().click();
  await page.waitForLoadState('domcontentloaded');
  await expect.poll(() => pathOf(page), { timeout: 15000 }).toBe(site.hero.ctaPath);
});

for (const [w, h] of [[390, 844], [430, 932]]) {
  test(`TC16 Home hero at ${w}x${h} wraps, is not cropped and the button is tappable @mobile`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await checkHero(page, { tap: true });
    await page.locator('a.jasy-hero__button').first().click();
    await page.waitForLoadState('domcontentloaded');
    await expect.poll(() => pathOf(page), { timeout: 15000 }).toBe(site.hero.ctaPath);
  });
}

async function cardReport(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('a.jasy-discovery__card'))
      .map((a) => {
        const r = a.getBoundingClientRect();
        const heading = a.querySelector('h2, h3, h4, [class*="title"]');
        return {
          name: ((heading && heading.innerText) || a.innerText || '').trim().split('\n')[0],
          path: new URL(a.href, location.href).pathname,
          left: r.left,
          right: r.right,
          top: r.top,
          bottom: r.bottom,
          width: r.width,
          height: r.height,
          screenW: window.innerWidth,
        };
      })
      .filter((c) => c.width > 0 && c.height > 0)
  );
}

function expectNoOverlap(cards) {
  for (let a = 0; a < cards.length; a++) {
    for (let b = a + 1; b < cards.length; b++) {
      const w = Math.min(cards[a].right, cards[b].right) - Math.max(cards[a].left, cards[b].left);
      const h = Math.min(cards[a].bottom, cards[b].bottom) - Math.max(cards[a].top, cards[b].top);
      expect(w > 2 && h > 2, 'Category cards "' + cards[a].name + '" and "' + cards[b].name + '" overlap').toBe(false);
    }
  }
}

for (const [id, tag] of [['TC17', '@desktop'], ['TC18', '@mobile']]) {
  test(`${id} Home category cards have the right title and destination, no overlap, each opens ${tag}`, async ({ page }) => {
    await gotoSettled(page, '/');
    const cards = await cardReport(page);
    expect(cards.length, 'Found ' + cards.length + ' category cards, expected ' + site.drawerCategories.length).toBeGreaterThanOrEqual(site.drawerCategories.length);
    expect(cards.every((c) => c.left >= -1 && c.right <= c.screenW + 1), 'A category card runs off the screen').toBe(true);
    expectNoOverlap(cards);
    for (const category of site.drawerCategories) {
      const card = cards.find((c) => c.path === category.path);
      expect(card, 'No category card links to ' + category.path).toBeDefined();
      expect(card.name.toLowerCase(), 'The card for ' + category.path + ' says "' + card.name + '"').toContain(category.name.toLowerCase());
    }
    for (const category of site.drawerCategories) {
      await gotoSettled(page, '/');
      await page.locator('a.jasy-discovery__card[href*="' + category.path + '"]').first().click();
      await page.waitForLoadState('domcontentloaded');
      await expect.poll(() => pathOf(page), { timeout: 15000 }).toBe(category.path);
    }
  });
}

// ---------- TC21: collection card ----------

test('TC21 A collection card opens the matching product page', async ({ page }) => {
  await gotoSettled(page, site.hero.ctaPath);
  const link = page.locator('a.product-card__link').and(visible(page)).first();
  const path = new URL(await link.getAttribute('href'), 'https://x.invalid').pathname;
  // The card picture sits on top of the link, so a normal click waits forever. A shopper clicks the picture, so the test does too.
  await link.click({ force: true });
  await expect.poll(() => pathOf(page), { timeout: 15000, message: 'The card click did not open ' + path }).toBe(path);
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  await expect(page.locator('main')).toContainText('$');
});

// ---------- TC26, TC27: secondary regression product ----------

test('TC26 Secondary product: the Red variant shows as selected and the price stays', async ({ page }) => {
  await gotoSettled(page, productPath);
  const picker = await page.evaluate(() => {
    const p = document.querySelector('variant-picker');
    if (p === null) return null;
    return { text: p.innerText.replace(/\s+/g, ' ').trim(), radios: Array.from(p.querySelectorAll('input[type="radio"]')).map((i) => ({ value: i.value, checked: i.checked })) };
  });
  expect(picker, 'The product page has no variant picker').not.toBeNull();
  expect(picker.text, 'The variant picker does not show "' + site.product.variant + '"').toContain(site.product.variant);
  if (picker.radios.length > 0) {
    const red = picker.radios.find((r) => r.value.toLowerCase().includes('red'));
    expect(red && red.checked, 'Red is not the selected variant: ' + JSON.stringify(picker.radios)).toBeTruthy();
  }
  const text = await page.locator('main').innerText();
  expect(text, 'The price is not ' + site.product.price).toContain(site.product.price);
  expect(text, 'The page says Sold out or Unavailable').not.toMatch(/sold out|unavailable/i);
});

test('TC27 Quantity controls: plus, minus and invalid values', async ({ page }) => {
  await gotoSettled(page, productPath);
  const input = page.locator('main input[name="quantity"]').first();
  const plus = page.locator('button.quantity-plus').and(visible(page)).first();
  const minus = page.locator('button.quantity-minus').and(visible(page)).first();
  await plus.click();
  await expect(input).toHaveValue('2');
  await minus.click();
  await expect(input).toHaveValue('1');
  // At 1 the theme switches the minus button off, which is the right behavior.
  if (await minus.isEnabled()) await minus.click();
  await page.waitForTimeout(600);
  expect(Number(await input.inputValue()), 'Minus took the quantity below 1').toBeGreaterThanOrEqual(1);
  for (const bad of ['0', '-3']) {
    await gotoSettled(page, productPath);
    await clearCart(page);
    const field = page.locator('main input[name="quantity"]').first();
    await field.fill(bad);
    await field.press('Tab');
    await page.waitForTimeout(900);
    const value = Number(await field.inputValue());
    if (value < 1) {
      test.info().annotations.push({ type: 'finding', description: 'The quantity box keeps ' + value + ' after typing ' + bad });
      const add = await findAddToCart(page);
      if (add !== null) await add.click();
      await page.waitForTimeout(3000);
      const count = (await getCart(page)).item_count;
      expect(count, 'Add to cart with quantity ' + value + ' put ' + count + ' items in the cart').toBeLessThanOrEqual(1);
      await clearCart(page);
    }
  }
});

// ---------- TC29 to TC32: Judge.me reviews (reading and opening the form only) ----------

async function scrollToReviews(page) {
  const button = page.locator('button:has-text("Write a review"), a:has-text("Write a review")').and(visible(page)).first();
  for (let step = 0; step < 14; step++) {
    if ((await button.count()) > 0 && (await button.isVisible())) {
      await button.scrollIntoViewIfNeeded();
      return button;
    }
    await page.evaluate(() => window.scrollBy(0, 700));
    await page.waitForTimeout(500);
  }
  throw new Error('The review widget ("Write a review") never appeared on the product page');
}

async function reviewText(button) {
  return button.evaluate((b) => {
    const box = b.closest('[class*="jdgm"], [id*="judgeme"], [class*="judge"], .shopify-app-block, section') || b.parentElement;
    return (box.innerText || '').replace(/\s+/g, ' ').trim();
  });
}

for (const [id, tag] of [['TC29', '@desktop'], ['TC30', '@mobile']]) {
  test(`${id} Review widget (Judge.me) is on the product page, readable and covers nothing ${tag}`, async ({ page }) => {
    await gotoSettled(page, productPath);
    const button = await scrollToReviews(page);
    await expect(page.locator('[class*="jdgm"]').first()).toBeAttached();
    const box = await button.boundingBox();
    const view = page.viewportSize();
    expect(box.x >= 0 && box.x + box.width <= view.width + 1, 'The "Write a review" button runs off the screen').toBe(true);
    const covered = await button.evaluate((b) => {
      const r = b.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !(top === b || b.contains(top));
    });
    expect(covered, 'Something covers the "Write a review" button').toBe(false);
    expect(await horizontalOverflow(page), 'The review area makes the page scroll sideways').toBeLessThanOrEqual(1);
  });
}

test('TC31 With no genuine reviews an empty state shows and no sample reviews', async ({ page }) => {
  await gotoSettled(page, productPath);
  const button = await scrollToReviews(page);
  const text = await reviewText(button);
  const live = await page.locator('.jdgm-rev').count();
  expect(text, 'The review area shows no text at all').not.toBe('');
  expect(text, 'The review area looks like it shows sample reviews').not.toMatch(/sample review|preview review|\(preview\)|demo review|example review/i);
  expect(live, live + ' review(s) are shown. If they are genuine customer reviews this is fine, otherwise remove them.').toBe(0);
});

test('TC32 Write a review opens the form (nothing is typed or sent)', async ({ page }) => {
  await gotoSettled(page, productPath);
  const button = await scrollToReviews(page);
  await button.click();
  await page.waitForTimeout(1500);
  const body = await page.locator('body').innerText();
  if (/already reviewed this product/i.test(body)) {
    const notNow = page.getByRole('button', { name: /^not now$/i });
    if ((await notNow.count()) > 0) await notNow.first().click();
    return;
  }
  const modal = page.locator('.jdgm-write-review-modal');
  expect((await modal.isVisible().catch(() => false)) || /your name|review title|rating/i.test(body), 'The review form did not open').toBe(true);
  const close = page.locator('button.jdgm-write-review-modal__close-btn');
  if ((await close.count()) > 0) await close.first().click();
  else await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  expect(await modal.isVisible().catch(() => false), 'The review form did not close').toBe(false);
});

// ---------- TC38, TC39, TC41: checkout up to shipping (guarded: CHECKOUT_TEST=1) ----------

const customer = { email: 'jasy.test+qa@example.com', firstName: 'Test', lastName: 'Shopper', address1: '123 Test Street', city: 'Austin', state: 'Texas', zip: '78701' };

async function openCheckout(page) {
  await clearCart(page);
  await addProductByApi(page, site.product.handle);
  await gotoSettled(page, '/cart');
  await page.getByRole('button', { name: /check ?out/i }).first().click();
  await page.waitForURL(/\/checkouts?\//, { timeout: 30000 });
  await page.waitForTimeout(3000);
}

async function fillFirst(page, selectors, value, name) {
  for (const css of selectors) {
    const el = page.locator(css).and(visible(page)).first();
    if ((await el.count()) > 0) {
      await el.fill(value);
      return;
    }
  }
  throw new Error('Checkout has no visible "' + name + '" field (tried ' + selectors.join(', ') + ')');
}

async function fillCustomer(page) {
  await fillFirst(page, ['input[name="email"]', 'input#email', 'input[type="email"]'], customer.email, 'Email');
  await fillFirst(page, ['input[name="firstName"]', 'input[autocomplete="given-name"]'], customer.firstName, 'First name');
  await fillFirst(page, ['input[name="lastName"]', 'input[autocomplete="family-name"]'], customer.lastName, 'Last name');
  await fillFirst(page, ['input[name="address1"]', 'input[autocomplete="address-line1"]'], customer.address1, 'Address');
  await fillFirst(page, ['input[name="city"]', 'input[autocomplete="address-level2"]'], customer.city, 'City');
  const state = page.locator('select[name="zone"], select[autocomplete="address-level1"]').first();
  if ((await state.count()) > 0) await state.selectOption({ label: customer.state });
  await fillFirst(page, ['input[name="postalCode"]', 'input[autocomplete="postal-code"]'], customer.zip, 'ZIP code');
  await page.waitForTimeout(3000);
}

test.describe('Checkout up to shipping (guarded: CHECKOUT_TEST=1). Made-up customer, no card, no Pay button', () => {
  test.skip(process.env.CHECKOUT_TEST !== '1', 'Guarded: set CHECKOUT_TEST=1 to run (types made-up details, never pays).');

  test('TC38 Required fields validate and errors are understandable', async ({ page }) => {
    await openCheckout(page);
    await fillFirst(page, ['input[name="email"]', 'input#email', 'input[type="email"]'], 'not-an-email', 'Email');
    await page.keyboard.press('Tab');
    await page.waitForTimeout(1500);
    const text = await page.locator('body').innerText();
    expect(text, 'No clear error for a bad email').toMatch(/valid email|enter an email|email.*invalid|invalid.*email/i);
    await fillCustomer(page);
    await clearCart(page);
  });

  test('TC39 A valid address shows a shipping method with a price', async ({ page }) => {
    await openCheckout(page);
    await fillCustomer(page);
    await page.waitForTimeout(3000);
    const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    const at = text.search(/shipping method|shipping/i);
    expect(at, 'No shipping area on the checkout page').toBeGreaterThan(-1);
    const area = text.slice(at, at + 250);
    test.info().annotations.push({ type: 'note', description: 'Shipping area: ' + area });
    expect(area, 'No shipping price or "Free" found near the shipping area').toMatch(/\$\s?\d|free/i);
    await clearCart(page);
  });

  test('TC41 The order summary matches the cart with no surprise fee', async ({ page }) => {
    await openCheckout(page);
    await fillCustomer(page);
    const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    expect(text, 'The summary does not show the product').toContain(site.product.title);
    const money = (label) => {
      const m = text.match(new RegExp(label + '\\s*\\$\\s?([\\d,]+\\.\\d\\d)', 'i'));
      return m ? Number(m[1].replace(',', '')) : null;
    };
    const subtotal = money('Subtotal');
    const total = money('Total');
    test.info().annotations.push({ type: 'note', description: 'Subtotal ' + subtotal + ', total ' + total });
    expect(subtotal, 'No subtotal found').not.toBeNull();
    expect(total, 'No total found').not.toBeNull();
    expect(total, 'The total is lower than the subtotal').toBeGreaterThanOrEqual(subtotal);
    await clearCart(page);
  });
});

// ---------- TC49 to TC52: Shopify Inbox live chat ----------

const chatBubble = (page) => page.locator('button[aria-label*="chat" i], [role="button"][aria-label*="chat" i]').and(page.locator(':not([aria-label*="close" i])')).first();

async function chatText(page) {
  return page.evaluate(() => {
    const parts = [];
    const collect = (root) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const n = walker.currentNode;
        const tag = n.parentElement ? n.parentElement.tagName : '';
        if (tag !== 'STYLE' && tag !== 'SCRIPT' && n.textContent.trim() !== '') parts.push(n.textContent.trim());
      }
      for (const el of root.querySelectorAll('*')) if (el.shadowRoot) collect(el.shadowRoot);
    };
    const host = document.querySelector('shopify-chat');
    if (host !== null) {
      collect(host);
      if (host.shadowRoot) collect(host.shadowRoot);
    }
    return parts.join(' ').replace(/\s+/g, ' ');
  });
}

async function openChat(page) {
  await expect(chatBubble(page), 'No chat bubble appeared in 25 seconds').toBeVisible({ timeout: 25000 });
  await chatBubble(page).click();
  await page.waitForTimeout(1500);
}

// Goes past the sign-in screen and waits for the welcome text. Returns the chat text.
async function settleChat(page, seconds = 15) {
  const skip = page.getByText(/continue without signing in/i).first();
  if ((await skip.count()) > 0 && (await skip.isVisible().catch(() => false))) await skip.click();
  const end = Date.now() + seconds * 1000;
  while (Date.now() < end) {
    const text = await chatText(page);
    if (text.includes(site.chat.greeting)) return text;
    await page.waitForTimeout(1500);
  }
  return chatText(page);
}

async function closeChat(page) {
  const close = page.locator('button[aria-label*="close chat" i], button[aria-label*="minimize" i]').first();
  if ((await close.count()) > 0) await close.click();
  else await chatBubble(page).click();
  await page.waitForTimeout(800);
}

test('TC49 The chat bubble is visible, on screen and does not cover key content', async ({ page }) => {
  await gotoSettled(page, '/');
  await expect(chatBubble(page), 'No chat bubble appeared in 25 seconds').toBeVisible({ timeout: 25000 });
  const view = page.viewportSize();
  const box = await chatBubble(page).boundingBox();
  expect(box.x >= 0 && box.y >= 0 && box.x + box.width <= view.width + 1 && box.y + box.height <= view.height + 1, 'The chat bubble is partly off the screen').toBe(true);
  await gotoSettled(page, productPath);
  await expect(chatBubble(page)).toBeVisible({ timeout: 25000 });
  const add = await findAddToCart(page);
  expect(add, 'No Add to cart button').not.toBeNull();
  const a = await add.boundingBox();
  const b = await chatBubble(page).boundingBox();
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  expect(w > 2 && h > 2, 'The chat bubble covers the Add to cart button').toBe(false);
});

test('TC50 The chat panel opens and closes without blocking the page', async ({ page }) => {
  // This theme may scroll an inner box instead of the browser window, so look at every box that can scroll.
  const facts = () => page.evaluate(() => {
    let y = window.scrollY;
    let scroller = 'window';
    for (const e of document.querySelectorAll('*')) {
      if (e.scrollTop > y) {
        y = e.scrollTop;
        scroller = e.tagName.toLowerCase() + '.' + String(e.className).slice(0, 40);
      }
    }
    return { y, scroller, height: document.documentElement.scrollHeight, view: window.innerHeight, htmlOverflow: getComputedStyle(document.documentElement).overflow, bodyOverflow: getComputedStyle(document.body).overflow };
  });
  await gotoSettled(page, '/');
  const before = await facts();
  await openChat(page);
  const text = await settleChat(page);
  test.info().annotations.push({ type: 'note', description: 'Chat panel text: ' + text.slice(0, 300) });
  if (text.includes(site.chat.greeting) === false) test.info().annotations.push({ type: 'finding', description: 'The chat panel opened but its welcome text did not load' });
  await closeChat(page);
  await expect(chatBubble(page), 'The chat bubble is gone after closing').toBeVisible();
  if (isMobile(page)) {
    await page.evaluate(() => {
      window.scrollTo(0, 600);
      for (const e of document.querySelectorAll('*')) {
        const o = getComputedStyle(e).overflowY;
        if (e.scrollHeight > e.clientHeight + 100 && (o === 'auto' || o === 'scroll')) e.scrollTop = 600;
      }
    });
  } else {
    await page.mouse.move(400, 400);
    await page.mouse.wheel(0, 600);
  }
  await page.waitForTimeout(1200);
  const scrolled = await facts();
  expect(scrolled.y, 'The page would not scroll after the chat closed. Before the chat was opened: ' + JSON.stringify(before) + '. After closing it: ' + JSON.stringify(scrolled)).toBeGreaterThan(50);
  if (isMobile(page)) {
    await openDrawer(page);
    await page.getByRole('button', { name: /^close$/i }).first().click();
  }
});

test('TC51 Suggested questions, message field and send control (sends only with CHAT_SEND=1)', async ({ page }) => {
  await gotoSettled(page, '/');
  await openChat(page);
  const text = await settleChat(page);
  test.skip(text.includes(site.chat.greeting) === false, 'The chat content did not load, so there is nothing to test yet. It says: ' + text.slice(0, 120));
  const field = page.locator('shopify-chat textarea, shopify-chat input[type="text"], shopify-chat [contenteditable="true"], shopify-chat [role="textbox"]').first();
  await expect(field, 'The chat has no message field').toBeVisible();
  await field.click();
  if (process.env.CHAT_SEND === '1') {
    await field.fill('Test message from the QA suite - please ignore.');
    const send = page.locator('shopify-chat button[aria-label*="send" i]').first();
    await expect(send, 'No Send control appeared after typing').toBeVisible();
    await send.click();
    await page.waitForTimeout(3000);
  }
  await closeChat(page);
});

test('TC52 The privacy notice is readable and the chat panel fits the screen at each size', async ({ page }) => {
  const sizes = isMobile(page) ? [[390, 844], [430, 932]] : [[1440, 900]];
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h });
    await gotoSettled(page, '/');
    await openChat(page);
    const text = await settleChat(page);
    test.skip(text.includes(site.chat.greeting) === false, 'The chat content did not load, so the privacy notice cannot be read yet. It says: ' + text.slice(0, 120));
    expect(text, 'No privacy or AI notice in the chat panel at ' + w + 'x' + h).toMatch(/privacy|terms|\bAI\b|automated|assistant/i);
    const close = page.locator('button[aria-label*="close chat" i], button[aria-label*="minimize" i]').first();
    const box = await close.boundingBox();
    expect(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= w + 1 && box.y + box.height <= h + 1, 'The close button is off the screen at ' + w + 'x' + h).toBeTruthy();
    await closeChat(page);
  }
});

// ---------- TC53 to TC56: Silicone Pet Bath & Massage Brush ----------

test('TC53 Bath brush page shows title, gallery, choices, price, quantity and Add to cart', async ({ page }) => {
  const prod = await brush.product(page);
  await brush.open(page);
  const title = await page.evaluate(() => {
    const h = Array.from(document.querySelectorAll('h1')).find((e) => e.getBoundingClientRect().width > 10) || document.querySelector('h1');
    return h ? h.innerText.trim() : '';
  });
  test.info().annotations.push({ type: 'note', description: 'Title: ' + title + '. Options: ' + brush.describeOptions(prod) });
  for (const word of site.brush.titleWords) must(title.toLowerCase().includes(word), 'The page title "' + title + '" does not contain "' + word + '"');
  must(prod.options.length >= 2, 'Expected a color and a style choice, the store lists ' + prod.options.length + ' option group(s)');
  const lowest = Math.min(...prod.variants.map((v) => v.price));
  expect(brush.money(lowest), 'Lowest price').toBe(site.brush.price);
  const st = await brush.state(page);
  must(st.price !== '', 'No price is shown on the page');
  for (const group of prod.options) {
    const shown = group.values.filter((v) => st.pickerText.includes(v.toLowerCase()));
    must(shown.length > 0, 'None of the "' + group.name + '" choices (' + group.values.slice(0, 4).join(', ') + ') show on the page. Page choices say: ' + st.pickerText.slice(0, 200));
  }
  const description = await page.evaluate((html) => {
    const d = document.createElement('div');
    d.innerHTML = html;
    const text = d.textContent.replace(/\s+/g, ' ').trim().slice(0, 25).toLowerCase();
    return { text, present: text !== '' && document.body.textContent.replace(/\s+/g, ' ').toLowerCase().includes(text) };
  }, prod.description || '');
  must(description.present, 'The product description ("' + description.text + '...") is not on the page');
  await expect(page.locator('main input[name="quantity"]').first(), 'No quantity box').toBeVisible();
  await expect(page.locator('button.quantity-plus').and(visible(page)).first(), 'No quantity plus button').toBeVisible();
  must(st.add.found, 'No Add to cart or Sold out button is visible');
  const images = await page.locator('main img').evaluateAll((list) => list.filter((i) => i.getBoundingClientRect().width > 100).length);
  must(images >= 2, 'Expected a gallery with at least 2 pictures, found ' + images);
  expect(await brokenImages(page), 'Images that did not load').toEqual([]);
  expect(await horizontalOverflow(page), 'The page scrolls sideways').toBeLessThanOrEqual(1);
});

test('TC54 Bath brush: several colors, then a compatible style, update selection, picture and address', async ({ page }) => {
  const prod = await brush.product(page);
  await brush.open(page);
  const pictures = new Set([(await brush.state(page)).image]);
  for (const color of brush.colorValues(prod).slice(0, 3)) {
    await brush.choose(page, color);
    pictures.add((await brush.state(page)).image);
    must(await brush.isChosen(page, prod, color), 'After clicking "' + color + '" the page does not show it as chosen');
  }
  for (const combo of site.brush.combos) {
    const c = brush.comboVariant(prod, combo);
    must(c.error === undefined, c.error);
    await brush.choose(page, c.first);
    await brush.choose(page, c.second);
    const st = await brush.state(page);
    pictures.add(st.image);
    must(await brush.isChosen(page, prod, c.first), '"' + c.first + '" does not show as chosen');
    must(await brush.isChosen(page, prod, c.second), '"' + c.second + '" does not show as chosen');
    expect(String(st.variantParam), 'The page address variant for ' + combo.join(' + ')).toBe(String(c.variant.id));
    if (c.variant.available) must(brush.addIsReady(st), 'FINDING: ' + combo.join(' + ') + ' is available but Add to cart is not ready: ' + JSON.stringify(st.add));
    else test.info().annotations.push({ type: 'finding', description: combo.join(' + ') + ' is sold out in the store' });
  }
  must(pictures.size > 1, 'FINDING: the picture on screen never changed when colors and styles were chosen');
});

test('TC55 Bath brush: a sold-out combination cannot be bought and the wrong variant is not added', async ({ page }) => {
  const prod = await brush.product(page);
  const soldOut = prod.variants.filter((v) => v.available === false);
  test.skip(soldOut.length === 0, 'Every bath brush combination is in stock right now, so there is nothing sold out to test.');
  for (const variant of soldOut.slice(0, 2)) {
    await brush.open(page);
    await clearCart(page);
    await brush.choose(page, variant.option1);
    if (variant.option2) await brush.choose(page, variant.option2);
    const st = await brush.state(page);
    if (String(st.variantParam) === String(variant.id)) {
      must(brush.addIsReady(st) === false, 'FINDING: ' + variant.title + ' is sold out but the page still offers Add to cart: ' + JSON.stringify(st.add));
    }
    const cart = await getCart(page);
    must(cart.items.every((i) => i.variant_id !== variant.id), 'The sold-out variant ' + variant.title + ' is in the cart');
  }
});

test('TC56 Bath brush: the chosen combination lands in the cart once, with the right line', async ({ page }) => {
  test.setTimeout(150000);
  const prod = await brush.product(page);
  let variant = null;
  for (const combo of site.brush.combos) {
    const c = brush.comboVariant(prod, combo);
    if (c.error === undefined && c.variant.available) {
      variant = c.variant;
      break;
    }
  }
  if (variant === null) variant = prod.variants.find((v) => v.available) || null;
  must(variant !== null, 'No available bath brush combination to add');
  await brush.open(page);
  await clearCart(page);
  await brush.choose(page, variant.option1);
  if (variant.option2) await brush.choose(page, variant.option2);
  const add = await findAddToCart(page);
  expect(add, 'No visible, enabled Add to cart button').not.toBeNull();
  await add.click();
  let seen = 'no reading yet';
  try {
    await expect.poll(async () => {
      try {
        const c = await getCart(page);
        seen = c.item_count + ' items';
        return c.item_count;
      } catch (e) {
        seen = 'error: ' + String(e.message).slice(0, 150);
        return -1;
      }
    }, { timeout: 40000, intervals: [1500, 3000] }).toBe(1);
  } catch (e) {
    throw new Error('The cart never showed 1 item. Last reading: ' + seen + '. Page address: ' + page.url());
  }
  const cart = await getCart(page);
  expect(cart.items.length, 'The cart has ' + cart.items.length + ' lines (duplicate or wrong variant?)').toBe(1);
  const line = cart.items[0];
  expect(line.quantity).toBe(1);
  expect(line.variant_id, 'Variant in the cart: ' + line.variant_title).toBe(variant.id);
  expect(line.price, 'Cart price').toBe(variant.price);
  for (const word of site.brush.titleWords) must(line.product_title.toLowerCase().includes(word), 'Wrong product in the cart: ' + line.product_title);
  must(Boolean(line.image), 'The cart line has no image');
  await gotoSettled(page, '/cart');
  const text = await page.locator('main').innerText();
  expect(text).toContain(variant.option1);
  if (variant.option2) expect(text.toLowerCase()).toContain(variant.option2.toLowerCase());
  expect(text).toContain(brush.money(variant.price));
  expect(await horizontalOverflow(page), 'The cart scrolls sideways').toBeLessThanOrEqual(1);
  await clearCart(page);
});
