const fs = require('fs');
const { test: setup } = require('@playwright/test');
const { unlockIfLocked } = require('./helpers/gate');

setup('open the storefront (enter the preview password if the store is locked)', async ({ page }) => {
  await unlockIfLocked(page);
  // Keep the unlock cookie but not any cart cookie, so every test starts with its own empty cart.
  const state = await page.context().storageState();
  state.cookies = state.cookies.filter((cookie) => /^cart/i.test(cookie.name) === false);
  fs.mkdirSync('.auth', { recursive: true });
  fs.writeFileSync('.auth/storefront.json', JSON.stringify(state));
});
