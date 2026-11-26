// WHERE things are on the storefront (CSS selectors, taken from the real page scan: npm run discover:ui in the project root).
// Links and buttons are mostly found by their text or label in the page objects.
export const locators = {
  // The hamburger button in the phone header.
  menuButton:
    'header button[aria-label*="menu" i], header summary[aria-label*="menu" i], header [role="button"][aria-label*="menu" i], header summary, summary.header__icon--menu',
  // The X inside the open menu.
  menuClose: '.menu-drawer__close-button, button[aria-label="Close"]',
  // Links inside the phone menu: a#HeaderDrawer-home, a#HeaderDrawer-shop-essentials, ...
  drawerLinks: 'a[id^="HeaderDrawer-"]',
  // The password field on the "Opening soon" page.
  passwordInput: 'input[type="password"]',

  logo: 'a.header-logo',
  searchInput: 'input[type="search"], input[name="q"]',
  searchResultLink: 'a.resource-card__link, a[href*="/products/"]',
  accountEmail: 'input#login-form-email',

  // Home page
  heroButton: 'a.jasy-hero__button',
  categoryCards: 'a.jasy-discovery__card',

  // Footer
  policyTrigger: 'button.policy-list-trigger',

  // Collection and product cards
  productCardLink: 'a.product-card__link',

  // Product page
  quantityInput: 'input[name="quantity"]',
  quantityPlus: 'button.quantity-plus',
  quantityMinus: 'button.quantity-minus',
  galleryDots: 'button.slideshow-control',
  mobileBack: 'a.jasy-mobile-back',

  // Reviews (Judge.me)
  reviewModal: '.jdgm-write-review-modal',
  reviewModalClose: 'button.jdgm-write-review-modal__close-btn',
  liveReviews: '.jdgm-rev',
};
