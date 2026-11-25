// One-time helper for TC-19 and TC-20. Opens a phone-sized browser window, opens the store,
// and waits while YOU sign in (email, then the one-time code Shopify emails you).
// It then saves the signed-in session to .auth/customer.json (ignored by git).
// Nothing you type is read or stored by this script.
const readline = require('readline');
const { webkit } = require('@playwright/test');
const { unlockIfLocked } = require('../tests/helpers/gate');

(async () => {
  const baseURL = process.env.BASE_URL || 'https://jasyeveryday.com';
  const browser = await webkit.launch({ headless: false });
  const context = await browser.newContext({ baseURL, viewport: { width: 430, height: 900 } });
  const page = await context.newPage();
  await unlockIfLocked(page);
  await page.goto('/account');
  console.log('');
  console.log('A browser window is open. Sign in there with your own email and the one-time code.');
  console.log('When you can see your account page, come back to this Terminal and press Enter.');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise((resolve) => rl.question('Press Enter after you are signed in: ', resolve));
  rl.close();
  await context.storageState({ path: '.auth/customer.json' });
  await browser.close();
  console.log('Saved .auth/customer.json. TC-19 and TC-20 will now run.');
})();
