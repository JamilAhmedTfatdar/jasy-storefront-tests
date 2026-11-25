// Opens the storefront. If the store is still locked ("Opening soon" page),
// enters the storefront preview password from the STOREFRONT_PASSWORD
// environment variable. The password is never written to any file.
async function unlockIfLocked(page) {
  await page.goto('/');
  if (page.url().indexOf('/password') === -1) return false;

  const pw = process.env.STOREFRONT_PASSWORD;
  if (pw === undefined || pw === '') {
    throw new Error('The store is password protected. Set STOREFRONT_PASSWORD first (see README).');
  }

  const field = page.locator('input[type="password"]').first();
  if ((await field.isVisible()) === false) {
    await page.getByText(/enter.*password/i).first().click();
  }
  await field.fill(pw);
  await field.press('Enter');

  try {
    await page.waitForURL((url) => url.pathname.indexOf('/password') === -1, { timeout: 15000 });
  } catch (e) {
    throw new Error('The store password was not accepted. Check STOREFRONT_PASSWORD.');
  }
  return true;
}

module.exports = { unlockIfLocked };
