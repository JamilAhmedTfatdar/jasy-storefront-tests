// "One window" mode. Normally every test opens its own fresh browser window and closes it again.
// With ONE_WINDOW=1 all tests in a run share a single browser window and tab, so you can watch the
// whole run in one place. Between tests the page is reset: it goes blank, the cart is emptied and the
// window goes back to its normal size. Without ONE_WINDOW=1 nothing changes.
const base = require('@playwright/test');

const oneWindow = process.env.ONE_WINDOW === '1';

function contextOptions(u) {
  const options = {};
  for (const key of ['viewport', 'userAgent', 'deviceScaleFactor', 'isMobile', 'hasTouch', 'storageState', 'baseURL']) {
    if (u[key] !== undefined) options[key] = u[key];
  }
  return options;
}

const test = oneWindow
  ? base.test.extend({
      sharedPage: [
        async ({ browser }, use, workerInfo) => {
          const u = workerInfo.project.use;
          const context = await browser.newContext(contextOptions(u));
          context.setDefaultTimeout(u.actionTimeout || 15000);
          context.setDefaultNavigationTimeout(u.navigationTimeout || 30000);
          const page = await context.newPage();
          console.log('[one-window] opened the shared browser window for the ' + workerInfo.project.name + ' tests');
          await use(page);
          await context.close();
        },
        { scope: 'worker' },
      ],
      page: async ({ sharedPage, browser, storageState }, use, testInfo) => {
        const u = testInfo.project.use;
        if (storageState !== undefined && storageState !== u.storageState) {
          // This test brings its own saved login (TC-19 and TC-20), so it gets its own short-lived window.
          const own = await browser.newContext({ ...contextOptions(u), storageState });
          const ownPage = await own.newPage();
          await use(ownPage);
          await own.close();
          return;
        }
        await sharedPage.context().clearCookies({ name: /^cart/i });
        if (u.viewport) await sharedPage.setViewportSize(u.viewport);
        await use(sharedPage);
      },
      context: async ({ page }, use) => {
        await use(page.context());
      },
    })
  : base.test;

module.exports = { test, expect: base.expect };
