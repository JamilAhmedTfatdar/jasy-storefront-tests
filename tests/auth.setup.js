const fs = require('fs');
const { test: setup, chromium } = require('@playwright/test');
const { unlockIfLocked } = require('./helpers/gate');

setup('open the storefront (enter the preview password if the store is locked)', async ({ baseURL }) => {
  // This step always runs with no visible window, even when the other tests run with --headed.
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ baseURL });
    context.setDefaultTimeout(15000);
    context.setDefaultNavigationTimeout(30000);
    const page = await context.newPage();
    await unlockIfLocked(page);
    // Keep the unlock cookie but not any cart cookie, so every test starts with its own empty cart.
    const state = await context.storageState();
    state.cookies = state.cookies.filter((cookie) => /^cart/i.test(cookie.name) === false);
    fs.mkdirSync('.auth', { recursive: true });
    fs.writeFileSync('.auth/storefront.json', JSON.stringify(state));
  } finally {
    await browser.close();
  }
});
