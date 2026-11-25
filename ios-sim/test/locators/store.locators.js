// WHERE things are on the storefront (CSS selectors). Links and buttons are found by their text in the page objects.
export const locators = {
  // The hamburger button in the phone header.
  menuButton:
    'header button[aria-label*="menu" i], header summary[aria-label*="menu" i], header [role="button"][aria-label*="menu" i], header summary',
  // The X inside the open menu.
  menuClose: '.menu-drawer__close-button, button[aria-label="Close"]',
  // The password field on the "Opening soon" page.
  passwordInput: 'input[type="password"]',
};
