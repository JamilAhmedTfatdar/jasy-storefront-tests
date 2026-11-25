const fs = require('fs');
const { test, expect } = require('@playwright/test');

// TC-18 stops at the sign-in form: the one-time code that Shopify emails is never read or typed.
// TC-19 and TC-20 need a signed-in browser session. Run "npm run login" once, sign in yourself in
// the window that opens, and the session is saved in .auth/customer.json (never committed).

const CUSTOMER = '.auth/customer.json';
const hasLogin = fs.existsSync(CUSTOMER);

test.describe('TC-18 Customer sign-in', () => {
  test('TC-18 Account icon leads to the email sign-in form (entering the code is manual)', async ({ page }) => {
    await page.goto('/');
    const header = page.locator('header');
    const account = header
      .getByRole('button', { name: /account|sign in|log in/i })
      .or(header.getByRole('link', { name: /account|sign in|log in/i }))
      .first();
    await account.click();
    const signIn = page.getByRole('button', { name: /^sign in$/i }).or(page.getByRole('link', { name: /^sign in$/i })).first();
    try {
      await signIn.click({ timeout: 4000 });
    } catch (e) {
      // The icon may go straight to the sign-in page.
    }
    await expect(page.getByLabel(/email/i).first(), 'No email field on the sign-in page').toBeVisible({ timeout: 20000 });
    test.info().annotations.push({ type: 'manual', description: 'Entering the one-time code from the email is not automated.' });
  });
});

test.describe('TC-19 and TC-20 Signed-in account pages', () => {
  test.skip(hasLogin === false, 'Needs a saved sign-in. Run "npm run login" once (see README).');
  test.use({ storageState: hasLogin ? CUSTOMER : '.auth/storefront.json' });

  function accountUrl(baseURL, path) {
    const u = new URL(baseURL);
    return u.protocol + '//account.' + u.hostname + path;
  }

  test('TC-19 Profile page shows the customer email', async ({ page, baseURL }) => {
    await page.goto(accountUrl(baseURL, '/profile'));
    await expect(page).toHaveURL(/profile/);
    await expect(page.locator('body'), 'The profile page does not show an email address').toContainText('@', { timeout: 20000 });
  });

  test('TC-20 Orders page loads without errors', async ({ page, baseURL }) => {
    await page.goto(accountUrl(baseURL, '/orders'));
    await expect(page).toHaveURL(/orders/);
    await expect(page.locator('body')).not.toContainText(/something went wrong|error/i);
    const text = await page.locator('body').innerText();
    expect(text.length, 'The orders page looks empty').toBeGreaterThan(30);
  });
});
