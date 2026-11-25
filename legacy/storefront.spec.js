const { test, expect } = require('@playwright/test');
const site = require('./data/site.json');
const { clickMenuLink, getStatus, isMobile, hrefByText, openMenuIfMobile, resolveCollection, sitePaths } = require('./helpers/storefront');

test.describe('Pages and navigation', () => {
  test('SF-01 Homepage loads', async ({ page }) => {
    const response = await page.goto('/');
    expect(response.status()).toBeLessThan(400);
    await expect(page).toHaveTitle(/JASY/i);
    await expect(page.locator('header a[href="/"]:visible').first()).toBeVisible();
  });

  for (const name of site.navLinks) {
    test(`SF-02 Header link "${name}" works`, async ({ page }) => {
      await page.goto('/');
      await clickMenuLink(page, name);
      await page.waitForLoadState('domcontentloaded');
      await expect(page).not.toHaveTitle(/404|not found/i);
      const path = new URL(page.url()).pathname;
      if (name === 'Home') {
        expect(path).toBe('/');
      } else {
        expect(path).not.toBe('/');
      }
    });
  }

  test('SF-03 Hamburger menu opens and closes (phone only)', async ({ page }) => {
    test.skip(isMobile(page) === false, 'Phone layout only');
    await page.goto('/');
    const item = page.locator('header').getByRole('link', { name: site.navLinks[1], exact: true }).first();
    await expect(item).toBeHidden();
    await openMenuIfMobile(page);
    await expect(item).toBeVisible();
    await page.keyboard.press('Escape');
    try {
      await expect(item).toBeHidden({ timeout: 3000 });
    } catch (e) {
      await page.getByRole('button', { name: /close/i }).first().click();
    }
    await expect(item).toBeHidden();
  });

  test('SF-04 Header shows search, account and cart', async ({ page }) => {
    await page.goto('/');
    const header = page.locator('header');
    for (const name of [/search/i, /account|sign in|log in/i, /cart/i]) {
      await expect(header.getByRole("button", { name }).or(header.getByRole("link", { name })).first()).toBeVisible();
    }
  });

  for (const name of ['About Us', 'Contact Us']) {
    test(`SF-05 ${name} page loads`, async ({ page }) => {
      await page.goto('/');
      const href = await hrefByText(page, name);
      expect(href, `No "${name}" link found on the home page`).not.toBeNull();
      const response = await page.goto(href);
      expect(response.status()).toBeLessThan(400);
      await expect(page.locator('main h1, main h2').first()).toBeVisible();
    });
  }

  test('SF-06 Footer has the expected sections and working links', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer').last();
    for (const text of site.footerText) {
      await expect(footer).toContainText(text);
    }
    await expect(footer).toContainText(/©|copyright/i);
    await expect(footer.locator('input[type="email"]').first()).toBeVisible();

    const origin = new URL(page.url()).origin;
    const hrefs = await footer.locator('a[href]').evaluateAll((links) => links.map((a) => a.href));
    const sameSite = Array.from(new Set(hrefs.filter((h) => h.indexOf(origin) === 0)));
    for (const href of sameSite) {
      expect(await getStatus(page, href), href).toBeLessThan(400);
    }
  });

  test('SF-07 No Gmail address on customer-facing pages', async ({ page }) => {
    test.setTimeout(180000);
    const offenders = [];
    for (const path of await sitePaths(page)) {
      await page.goto(path);
      const html = await page.content();
      if (html.search(/@gmail\.com/i) > -1) offenders.push(path);
    }
    expect(offenders, 'Pages that mention @gmail.com').toEqual([]);
  });

  test('SF-08 Contact page shows the domain support email', async ({ page }) => {
    await page.goto('/');
    const href = await hrefByText(page, 'Contact Us');
    expect(href, 'No "Contact Us" link found').not.toBeNull();
    await page.goto(href);
    await expect(page.locator('body')).toContainText(site.supportEmail);
  });

  for (const name of site.categories) {
    test(`SF-09 Category "${name}" loads`, async ({ page }) => {
      const path = await resolveCollection(page, name);
      const response = await page.goto(path);
      expect(response.status(), path).toBeLessThan(400);
      await expect(page.locator('main h1').first()).toContainText(name, { ignoreCase: true });
      expect(await page.locator('a[href*="/products/"]').count(), 'No products listed').toBeGreaterThan(0);
    });
  }

  test('SF-22 Newsletter rejects an invalid email', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer').last();
    const input = footer.locator('input[type="email"]').first();
    await input.scrollIntoViewIfNeeded();
    await input.fill('not-an-email');
    await footer.getByRole('button', { name: /sign up/i }).first().click();
    expect(await input.evaluate((el) => el.validity.valid)).toBe(false);
    await expect(footer).not.toContainText(/thanks for subscribing/i);
  });

  test('SF-23 Contact email links use the domain address', async ({ page }) => {
    await page.goto('/');
    const href = await hrefByText(page, 'Contact Us');
    expect(href, 'No "Contact Us" link found').not.toBeNull();
    await page.goto(href);
    const mailtos = await page.locator('a[href^="mailto:"]').evaluateAll((links) => links.map((a) => a.getAttribute('href')));
    expect(mailtos.length, 'No mailto: link on the contact page').toBeGreaterThan(0);
    for (const m of mailtos) {
      expect(m.toLowerCase()).toMatch(/^mailto:support@jasyeveryday\.com/);
    }
  });
});
