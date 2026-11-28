// Phone checks in real Safari on the iOS Simulator. IDs and names follow the test plan (../TEST-CASES.md).
// Desktop-only cases (TC01, TC03, TC06, TC12, TC15, TC17, TC19, TC22, TC24, TC29) run in Playwright, not here.
// TC22, TC23 and TC26 use the secondary regression product (Mini Reusable Pet Hair Remover); TC53 to TC56 use the bath brush.
// Admin, CJ and payment cases (TC33 to TC34, TC40, TC42 to TC48) stay manual.
// Guarded cases only run when you switch them on:  CHECKOUT_TEST=1 (TC38, TC39, TC41)  CHAT_SEND=1 (sends one chat message in TC51)
//
// The Simulator uses its own screen size (about 402x874 for an iPhone 17), not exactly 390x844 or 430x932.
// Every test prints the real size it ran on.

import { site } from '../data/site.js';
import { must } from '../helpers/must.js';
import { locators } from '../locators/store.locators.js';
import Store from '../pageobjects/StorePage.js';
import Product from '../pageobjects/ProductPage.js';
import Brush from '../pageobjects/BrushPage.js';
import Cart from '../pageobjects/CartPage.js';
import Reviews from '../pageobjects/ReviewPage.js';
import Chat from '../pageobjects/ChatPage.js';
import Checkout from '../pageobjects/CheckoutPage.js';

const describeIf = (flag) => (process.env[flag] === '1' ? describe : describe.skip);
const productPath = '/products/' + site.product.handle;

describe('JASY Everyday in Safari on the iOS Simulator (phone test plan)', () => {
  before(async () => {
    await Store.unlockIfLocked();
  });

  describe('Store, header and menu', () => {
    it('TC02 (Mobile) the store opens without redirect loops or a broken layout', async () => {
      await Store.open('/');
      must((await browser.getUrl()).includes('/password') === false, 'The store shows the password page');
      await expect(browser).toHaveTitle(expect.stringContaining('JASY'));
      await expect($('main')).toBeDisplayed();
      await expect($(locators.logo)).toBeDisplayed();
      await Store.expectNoSideScroll('TC02 home');
    });

    it('TC04 (Mobile) no sideways scrolling on the main pages', async () => {
      for (const path of ['/', '/collections/shop-essentials', productPath, '/cart', '/pages/about-us']) {
        await Store.open(path);
        await browser.pause(1200);
        await Store.expectNoSideScroll('TC04 ' + path);
      }
    });

    it('TC05 (Mobile) the logo returns to the home page and keeps the session', async () => {
      await Store.open('/pages/about-us');
      const logo = await Store.firstDisplayed(locators.logo);
      await Store.tap(logo, 'Logo');
      await Store.waitForPath('/');
      must((await browser.getUrl()).includes('/password') === false, 'The logo sent the phone back to the password page');
    });

    it('TC07 (Mobile) search accepts a keyword and shows results or a clear empty state', async () => {
      await Store.open('/');
      await Store.search(site.product.searchKeyword);
      const text = await Store.bodyText();
      const results = (await $$(locators.searchResultLink)).length;
      console.log('TC07 search "' + site.product.searchKeyword + '": ' + results + ' result link(s), page ' + (await browser.getUrl()));
      must(results > 0 || /no results|no products|nothing found|try a different/i.test(text), 'Search showed neither results nor an empty-state message. Page says: ' + text.slice(0, 160));
    });

    it('TC08 (Mobile) the account icon opens sign-in without an error', async () => {
      await Store.open('/');
      // The account icon lives inside a shadow root, so it is found with the chat helper that looks inside those.
      const account = (await Chat.find('button.account-button')) || (await Chat.find('button', 'account'));
      must(account !== null, 'The account icon was not found in the header');
      await Chat.tapRef(account, 'Account');
      await browser.waitUntil(
        async () => (await Chat.find('input#login-form-email, input[type="email"]')) !== null || /account|login|authentication/i.test(await browser.getUrl()),
        { timeout: 15000, timeoutMsg: 'The account icon did not open a sign-in form or page' }
      );
      const text = await Store.bodyText();
      must(!/404|something went wrong|server error/i.test(text), 'The account page shows an error: ' + text.slice(0, 120));
    });

    it('TC09 (Mobile) the cart icon shows the empty-cart state', async () => {
      await Store.open('/');
      await Product.clearCart();
      await Store.open('/');
      const cart = await Store.headerButton('Cart');
      await Store.tap(cart, 'Cart');
      await browser.waitUntil(async () => /your cart is empty/i.test(await Store.bodyText()), {
        timeout: 15000,
        timeoutMsg: 'The cart icon did not show "Your cart is empty"',
      });
    });

    it('TC10 (Mobile) the menu opens, shows readable links and closes with X', async () => {
      await Store.open('/');
      await Store.openMenu();
      const links = await Store.drawerReport();
      console.log('TC10 menu links: ' + links.map((l) => l.text + ' ' + l.width + 'x' + l.height).join(' ; '));
      const names = links.map((l) => l.text);
      const missing = ['Home', 'Shop Essentials', 'About Us', 'Contact Us'].filter((n) => !names.includes(n));
      for (const link of links) {
        must(link.text !== '', 'A menu link has no text (' + link.id + ')');
        must(link.right <= link.screenW + 1, 'The menu link "' + link.text + '" runs off the screen');
        must(link.clipped === false, 'The menu link "' + link.text + '" is clipped');
      }
      await Store.closeMenuWithX();
      must(missing.length === 0, 'FINDING: the phone menu does not show ' + missing.join(' and ') + ' (the page marks those links as hidden). The plan expects Home, Shop Essentials, About Us and Contact Us. The menu shows: ' + names.join(', '));
    });

    it('TC11 (Mobile) menu links go to Home, Shop Essentials, About Us and Contact Us', async () => {
      const stops = [
        { id: 'HeaderDrawer-home', path: '/' },
        { id: 'HeaderDrawer-shop-essentials', path: '/collections/shop-essentials' },
        { id: 'HeaderDrawer-about-us', path: '/pages/about-us' },
        { id: 'HeaderDrawer-contact-us', path: '/pages/contact' },
      ];
      const missing = [];
      for (const stop of stops) {
        await Store.open('/collections/all');
        await Store.openMenu();
        const link = await $('#' + stop.id);
        if ((await link.isExisting()) === false || (await link.isDisplayed()) === false) {
          console.log('TC11 FINDING: the phone menu does not show ' + stop.id);
          missing.push(stop.id.replace('HeaderDrawer-', ''));
          continue;
        }
        await Store.tapDrawerLink(stop.id);
        try {
          await Store.waitForPath(stop.path, 4000);
        } catch (e) {
          // A menu entry with sub-links may open a sub-menu first; use its "Shop All" link.
          const all = await $$('//a[contains(normalize-space(.),"Shop All")]');
          let tapped = false;
          for (const el of all) {
            if (await el.isDisplayed()) {
              console.log('TC11 ' + stop.id + ' opened a sub-menu; tapping "' + (await el.getText()) + '"');
              await Store.tap(el, 'Shop All');
              tapped = true;
              break;
            }
          }
          must(tapped, stop.id + ' did not go to ' + stop.path + ' and no "Shop All" link appeared');
          await Store.waitForPath(stop.path);
        }
      }
      must(missing.length === 0, 'FINDING: these links are not visible in the phone menu: ' + missing.join(', ') + '. The other links work.');
    });

    it('TC13 (Mobile) footer Helpful links are reachable and open the right pages', async () => {
      await Store.open('/');
      must(await Store.helpfulLinksHeadingDisplayed(), 'The footer has no "Helpful links" heading');
      for (const link of site.helpfulLinks) {
        await Store.open('/');
        await Store.tapFooterLink(link.name);
        await Store.waitForUrlToContain(link.path);
      }
    });

    it('TC14 (Mobile) footer policy links open readable policy pages', async () => {
      for (const policy of site.policies) {
        await Store.openPolicy(policy);
        await Store.waitForUrlToContain(policy.path);
        const text = await Store.bodyText();
        console.log('TC14 ' + policy.name + ': ' + text.length + ' characters of text');
        await expect($('h1')).toBeDisplayed();
        must(text.length > 400, policy.name + ' shows almost no text');
        must(!/page not found|404/i.test(text), policy.name + ' shows a not-found page');
      }
    });
  });

  describe('Home page and collections', () => {
    it('TC16 (Mobile) hero text wraps, the image shows and the button is tappable', async () => {
      await Store.open('/');
      await browser.pause(1500);
      let hero = await Store.heroInfo();
      for (let n = 0; n < 6 && !hero.images.every((i) => i.ok); n++) {
        await browser.pause(1500);
        hero = await Store.heroInfo();
      }
      console.log('TC16 hero images: ' + JSON.stringify(hero.images.map((i) => ({ ok: i.ok, w: i.width, top: i.top, src: i.src }))));
      console.log('TC16 hero: "' + hero.headline + '", button ' + JSON.stringify(hero.cta) + ', ' + hero.images.length + ' large image(s)');
      must(hero.headline.includes('Cleaner Home'), 'The hero headline is "' + hero.headline + '"');
      must(hero.headlineBox !== null && hero.headlineBox.left >= 0 && hero.headlineBox.right <= hero.screenW + 1, 'The hero headline runs off the screen');
      must(hero.headlineClipped === false, 'The hero headline is clipped');
      must(hero.images.length > 0 && hero.images.every((i) => i.ok), 'The hero image is missing or did not load: ' + hero.images.filter((i) => !i.ok).map((i) => i.src).join(', '));
      must(hero.images.every((i) => i.right <= hero.screenW + 1), 'A hero image is wider than the screen');
      must(hero.cta !== null && hero.cta.text.includes(site.hero.cta), 'The hero button "' + site.hero.cta + '" is missing');
      must(hero.cta.height >= 40, 'The hero button is only ' + hero.cta.height + 'px tall');
      const button = await $(locators.heroButton);
      await Store.tap(button, 'Hero button');
      await Store.waitForPath(site.hero.ctaPath);
    });

    it('TC18 (Mobile) category cards stack without overlap and each opens its page', async () => {
      await Store.open('/');
      const cards = await Store.categoryCardReport();
      console.log('TC18 cards: ' + cards.map((c) => c.name + ' ' + Math.round(c.width) + 'x' + Math.round(c.height)).join(' ; '));
      const homeCats = site.homeCategories || site.drawerCategories;
      must(cards.length >= homeCats.length, 'Found ' + cards.length + ' category cards, expected ' + homeCats.length);
      must(cards.every((c) => c.left >= 0 && c.right <= c.screenW + 1), 'A category card runs off the screen');
      await Store.expectCardsDoNotOverlap(cards);
      for (const category of homeCats) {
        await Store.open('/');
        const card = await $(locators.categoryCards + '[href*="' + category.path + '"]');
        await card.waitForExist({ timeout: 8000, timeoutMsg: 'No category card for ' + category.name });
        await Store.tap(card, category.name);
        await Store.waitForPath(category.path);
      }
    });

    it('TC20 (Mobile) the Shop Essentials collection is readable and scrolls', async () => {
      await Store.open(site.hero.ctaPath);
      await expect($('h1')).toBeDisplayed();
      const heading = (await $('h1').getText()).trim();
      must(/shop essentials/i.test(heading), 'The collection heading is "' + heading + '"');
      const cards = (await $$(locators.productCardLink)).length;
      const text = await Store.bodyText();
      console.log('TC20 ' + cards + ' product link(s); page shows a $ price: ' + text.includes('$'));
      must(cards > 0, 'The collection shows no product cards');
      must(text.includes('$'), 'No price is shown on the collection page');
      const y = await Store.scrollPage(600);
      must(y > 100, 'The collection page did not scroll (scrollY ' + y + ')');
      await Store.expectNoSideScroll('TC20 collection');
    });

    it('TC21 (Mobile) a collection card opens the matching product page', async () => {
      await Store.open(site.hero.ctaPath);
      const link = await Store.firstDisplayed(locators.productCardLink);
      const href = await link.getAttribute('href');
      const handle = new URL(href, 'https://x.invalid').pathname;
      await Store.tap(link, 'first product card');
      await Store.waitForPath(handle);
      await expect($('h1')).toBeDisplayed();
      const title = (await $('h1').getText()).trim();
      console.log('TC21 opened ' + handle + ' with heading "' + title + '"');
      must(title !== '', 'The product page has no title');
      must((await Store.bodyText()).includes('$'), 'The product page shows no price');
    });
  });

  describe('Product page', () => {
    it('TC23 (Mobile) core product information is visible without clipping', async () => {
      await Product.open();
      await browser.pause(1200);
      const title = (await $('h1').getText()).trim();
      const text = await Store.bodyText();
      must(title.toLowerCase().includes(site.product.titleWords), 'The product title is "' + title + '"');
      must(text.includes(site.product.price), 'The price ' + site.product.price + ' is not shown');
      must(text.includes(site.product.variant), 'The variant "' + site.product.variant + '" is not shown');
      await expect(await Store.firstDisplayed(locators.quantityInput)).toBeDisplayed();
      await expect(await Store.firstDisplayed('//button[contains(translate(normalize-space(.),"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"),"add to cart")]')).toBeDisplayed();
      await Store.expectNoSideScroll('TC23 product');
    });

    it('TC25 (Mobile) the gallery swipes, the dots work, Back works and there is no unexpected zoom', async () => {
      await Product.open();
      const swipe = await Product.swipeGalleryLeft();
      console.log('TC25 swipe moved ' + swipe.moved + 'px (' + swipe.how + ')');
      const dots = [];
      for (const dot of await $$(locators.galleryDots)) {
        if (await dot.isDisplayed()) dots.push(dot);
      }
      if (dots.length > 1) {
        const size = await browser.execute((d) => { const r = d.getBoundingClientRect(); return Math.round(r.width) + 'x' + Math.round(r.height); }, dots[dots.length - 1]);
        console.log('TC25 ' + dots.length + ' gallery dots, each about ' + size + (size.startsWith('18x') ? '  FINDING: smaller than the 44x44 touch size Apple recommends' : ''));
        const before = await Product.galleryPosition();
        await dots[0].click();
        await browser.pause(900);
        const after = await Product.galleryPosition();
        console.log('TC25 tapping the first dot moved the gallery from ' + Math.round(before) + ' to ' + Math.round(after));
        must(Math.abs(after - before) > 10, 'Tapping a gallery dot did not change the picture');
      } else {
        console.log('TC25 no gallery dots found (the gallery may use only swipe)');
      }
      const y = await Store.scrollPage(500);
      must(y > 50, 'The page would not scroll after using the gallery (scrollY ' + y + ')');
      const scale = await browser.execute(() => (window.visualViewport ? window.visualViewport.scale : 1));
      must(Math.abs(scale - 1) < 0.05, 'The page zoomed by itself (scale ' + scale + ')');
      // Back navigation: arrive from the collection, then use the "Back" link.
      await Store.open(site.hero.ctaPath);
      const card = await $(locators.productCardLink + '[href*="' + site.product.handle + '"]');
      if (await card.isExisting()) {
        await Store.tap(card, 'product card');
        await Store.waitForPath(productPath);
        const back = await $(locators.mobileBack);
        if (await back.isExisting()) {
          await Store.tap(back, 'Back');
          await browser.waitUntil(async () => new URL(await browser.getUrl()).pathname !== productPath, { timeout: 10000, timeoutMsg: 'Back did not leave the product page' });
        } else {
          console.log('TC25 no "Back" link on this page');
        }
      } else {
        console.log('TC25 this product is not on the first collection page; Back was not tested');
      }
    });

    it('TC26 (Mobile) the Red variant shows as selected and the price stays', async () => {
      await Product.open();
      const picker = await browser.execute(() => {
        const p = document.querySelector('variant-picker');
        if (p === null) return null;
        return { text: p.innerText.replace(/\s+/g, ' ').trim(), radios: Array.from(p.querySelectorAll('input[type="radio"]')).map((i) => ({ value: i.value, checked: i.checked })) };
      });
      console.log('TC26 variant picker: ' + JSON.stringify(picker));
      must(picker !== null, 'The product page has no variant picker');
      must(picker.text.includes(site.product.variant), 'The variant picker does not show "' + site.product.variant + '". It says: ' + picker.text);
      if (picker.radios.length > 0) {
        const red = picker.radios.find((r) => r.value.toLowerCase().includes('red'));
        must(red !== undefined && red.checked, 'Red is not the selected variant: ' + JSON.stringify(picker.radios));
      } else {
        console.log('TC26 Red is the only variant, so there is nothing to choose; it is selected by default');
      }
      const text = await Store.bodyText();
      must(text.includes(site.product.price), 'The price is not ' + site.product.price + ' after choosing Red');
      must(!/sold out|unavailable/i.test(text), 'The page says Sold out or Unavailable');
    });

    it('TC27 (Mobile) quantity plus, minus and invalid values', async () => {
      await Product.open();
      const input = await Store.firstDisplayed(locators.quantityInput);
      const plus = await Store.firstDisplayed(locators.quantityPlus);
      const minus = await Store.firstDisplayed(locators.quantityMinus);
      await Store.tap(plus, 'Increase quantity');
      await browser.waitUntil(async () => (await input.getValue()) === '2', { timeout: 6000, timeoutMsg: 'Plus did not change the quantity to 2' });
      await Store.tap(minus, 'Decrease quantity');
      await browser.waitUntil(async () => (await input.getValue()) === '1', { timeout: 6000, timeoutMsg: 'Minus did not change the quantity back to 1' });
      await Store.tap(minus, 'Decrease quantity');
      await browser.pause(600);
      must((await input.getValue()) === '1', 'Minus took the quantity below 1 (' + (await input.getValue()) + ')');
      for (const bad of ['0', '-3']) {
        await Product.open();
        await Product.clearCart();
        const field = await Store.firstDisplayed(locators.quantityInput);
        await browser.execute((el, v) => {
          el.value = v;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.blur();
        }, field, bad);
        await browser.pause(900);
        const value = Number(await field.getValue());
        console.log('TC27 typed ' + bad + ' and the field shows ' + value);
        if (value < 1) {
          console.log('TC27 FINDING: the quantity box keeps ' + value + '. Checking that Add to cart does not add it.');
          await Product.tapAddToCart();
          await browser.pause(3000);
          const count = await Product.cartCount();
          console.log('TC27 items in the cart after Add to cart with ' + value + ': ' + count);
          must(count >= 0 && count <= 1, 'Add to cart with quantity ' + value + ' put ' + count + ' items in the cart');
          await Product.clearCart();
        }
      }
    });

    it('TC28 (Mobile) Add to cart adds the product once', async () => {
      await Cart.addProduct();
      const cart = await Cart.data();
      must(cart !== null, 'The store did not answer with cart data (too many requests? wait 20 minutes)');
      console.log('TC28 cart: ' + cart.items.map((i) => i.quantity + ' x ' + i.product_title + ' / ' + i.variant_title + ' / ' + i.price / 100).join(' ; '));
      must(cart.items.length === 1, 'The cart has ' + cart.items.length + ' lines');
      must(cart.items[0].quantity === 1, 'The cart quantity is ' + cart.items[0].quantity);
      must(cart.items[0].product_title.toLowerCase().includes(site.product.titleWords), 'Wrong product in the cart: ' + cart.items[0].product_title);
      must(String(cart.items[0].variant_title).includes(site.product.variant), 'Wrong variant in the cart: ' + cart.items[0].variant_title);
      const idle = await browser.execute(() => typeof window.requestIdleCallback);
      console.log('TC28 requestIdleCallback in this Safari: ' + idle);
      await Product.clearCart();
    });
  });

  describe('Bath brush product (TC53 to TC56): color and style choices', () => {
    const shortName = (v) => v.option1 + ' + ' + v.option2;

    it('TC53 (Mobile) the bath brush page shows title, gallery, choices, price, quantity and Add to cart', async () => {
      const product = await Brush.product();
      must(product !== null, 'The store did not answer with the bath brush data (too many requests? wait 20 minutes)');
      await Brush.open();
      const title = await browser.execute(() => {
        const h = Array.from(document.querySelectorAll('h1')).find((e) => e.getBoundingClientRect().width > 10) || document.querySelector('h1');
        return h ? h.innerText.trim() : '';
      });
      console.log('TC53 title on the page: ' + title);
      console.log('TC53 options: ' + Brush.describeOptions(product));
      for (const word of site.brush.titleWords) must(title.toLowerCase().includes(word), 'The page title "' + title + '" does not contain "' + word + '"');
      must(product.options.length >= 2, 'Expected a color and a style choice, the store lists ' + product.options.length + ' option group(s)');
      const lowest = Math.min(...product.variants.map((v) => v.price));
      must(Brush.money(lowest) === site.brush.price, 'The lowest price is ' + Brush.money(lowest) + ', the plan says ' + site.brush.price);
      const state = await Brush.state();
      console.log('TC53 price shown: ' + state.price + '; Add to cart: ' + JSON.stringify(state.add));
      must(state.price !== '', 'No price is shown on the page');
      for (const group of product.options) {
        const shown = group.values.filter((v) => state.pickerText.includes(v.toLowerCase()));
        console.log('TC53 ' + group.name + ': ' + shown.length + ' of ' + group.values.length + ' choices are readable on the page');
        must(shown.length > 0, 'None of the "' + group.name + '" choices (' + group.values.slice(0, 4).join(', ') + ') show on the page. Page choices say: ' + state.pickerText.slice(0, 200));
      }
      const description = await browser.execute((html) => {
        const d = document.createElement('div');
        d.innerHTML = html;
        const text = d.textContent.replace(/\s+/g, ' ').trim().slice(0, 25).toLowerCase();
        return { text, present: text !== '' && document.body.textContent.replace(/\s+/g, ' ').toLowerCase().includes(text) };
      }, product.description || '');
      must(description.present, 'The product description ("' + description.text + '...") is not on the page');
      must(await Brush.isAnyDisplayed(locators.quantityInput), 'No quantity box is visible');
      must(await Brush.isAnyDisplayed(locators.quantityPlus), 'No quantity plus button is visible');
      must(state.add.found, 'No Add to cart or Sold out button is visible');
      const galleryOk = (await Product.tagGallery()) || (await browser.execute(() => Array.from(document.querySelectorAll('main img')).filter((i) => i.getBoundingClientRect().width > 100).length)) >= 2;
      must(galleryOk, 'No product picture gallery found');
      await Brush.expectNoSideScroll('TC53 bath brush');
    });

    it('TC54 (Mobile) several colors, then a compatible style, update the selection, picture and address', async () => {
      const product = await Brush.product();
      must(product !== null, 'The store did not answer with the bath brush data (too many requests? wait 20 minutes)');
      await Brush.open();
      const pictures = new Set();
      pictures.add((await Brush.state()).image);
      for (const color of Brush.colorValues(product).slice(0, 3)) {
        await Brush.choose(color);
        const chosen = await Brush.isChosen(product, color);
        const state = await Brush.state();
        pictures.add(state.image);
        console.log('TC54 color ' + color + ': chosen=' + chosen + ', picture=' + state.image.split('/').pop());
        must(chosen, 'After tapping "' + color + '" the page does not show it as chosen. Chosen: ' + state.picked.join(', '));
      }
      for (const combo of site.brush.combos) {
        const first = Brush.resolve(product, combo[0]);
        const second = Brush.resolve(product, combo[1]);
        must(first !== null && second !== null, 'Cannot match ' + combo.join(' + ') + ' with the store options. They are: ' + Brush.describeOptions(product));
        const variant = Brush.variantFor(product, [first.value, second.value]);
        must(variant !== null, 'The store has no variant ' + first.value + ' + ' + second.value);
        await Brush.choose(first.value);
        await Brush.choose(second.value);
        const state = await Brush.state();
        pictures.add(state.image);
        console.log('TC54 ' + combo.join(' + ') + ' -> variant ' + variant.id + ' (' + shortName(variant) + '), available=' + variant.available + ', address variant=' + state.variantParam + ', Add to cart: ' + JSON.stringify(state.add));
        must(await Brush.isChosen(product, first.value), '"' + first.value + '" does not show as chosen');
        must(await Brush.isChosen(product, second.value), '"' + second.value + '" does not show as chosen');
        must(String(state.variantParam) === String(variant.id), 'The page address has variant ' + state.variantParam + ', expected ' + variant.id + ' for ' + shortName(variant));
        if (variant.available) {
          must(Brush.addIsReady(state), 'FINDING: ' + shortName(variant) + ' is available but Add to cart is not ready: ' + JSON.stringify(state.add));
        } else {
          console.log('TC54 FINDING: ' + shortName(variant) + ' is sold out in the store, so Add to cart is not expected to work for it');
        }
      }
      console.log('TC54 pictures seen: ' + pictures.size);
      must(pictures.size > 1, 'FINDING: the picture on screen never changed when colors and styles were chosen');
    });

    it('TC55 (Mobile) a sold-out combination cannot be bought and the wrong variant is not added', async function () {
      const product = await Brush.product();
      must(product !== null, 'The store did not answer with the bath brush data (too many requests? wait 20 minutes)');
      const soldOut = product.variants.filter((v) => v.available === false);
      console.log('TC55 sold-out combinations in the store: ' + (soldOut.length === 0 ? 'none' : soldOut.map(shortName).join(' ; ')));
      if (soldOut.length === 0) {
        console.log('TC55 SKIPPED: every combination is in stock right now, so there is nothing sold out to test.');
        this.skip();
      }
      for (const variant of soldOut.slice(0, 2)) {
        await Brush.open();
        await Product.clearCart();
        const a = await Brush.choose(variant.option1);
        const b = variant.option2 ? await Brush.choose(variant.option2) : { disabled: false };
        const state = await Brush.state();
        const reached = String(state.variantParam) === String(variant.id);
        console.log('TC55 ' + shortName(variant) + ': first choice disabled=' + a.disabled + ', second choice disabled=' + b.disabled + ', reached sold-out variant=' + reached + ', Add to cart: ' + JSON.stringify(state.add));
        if (reached) {
          must(Brush.addIsReady(state) === false, 'FINDING: ' + shortName(variant) + ' is sold out but the page still offers Add to cart: ' + JSON.stringify(state.add));
        } else {
          console.log('TC55 the page does not let the sold-out combination be chosen (it stays on variant ' + state.variantParam + ')');
        }
        const cart = await Cart.data();
        if (cart === null) console.log('TC55 WARNING: no cart data (too many requests); skipping the cart check');
        else must(cart.items.every((i) => i.variant_id !== variant.id), 'The sold-out variant ' + shortName(variant) + ' is in the cart');
      }
    });

    it('TC56 (Mobile) the chosen bath brush combination lands in the cart once, with the right line', async () => {
      const product = await Brush.product();
      must(product !== null, 'The store did not answer with the bath brush data (too many requests? wait 20 minutes)');
      let variant = null;
      for (const combo of site.brush.combos) {
        const first = Brush.resolve(product, combo[0]);
        const second = Brush.resolve(product, combo[1]);
        const v = first && second ? Brush.variantFor(product, [first.value, second.value]) : null;
        if (v !== null && v.available) {
          variant = v;
          break;
        }
      }
      if (variant === null) variant = product.variants.find((v) => v.available) || null;
      must(variant !== null, 'No available bath brush combination to add');
      console.log('TC56 adding ' + shortName(variant) + ' (variant ' + variant.id + ', ' + Brush.money(variant.price) + ')');
      await Brush.open();
      await Product.clearCart();
      await Brush.choose(variant.option1);
      if (variant.option2) await Brush.choose(variant.option2);
      try {
        await Brush.waitForVariantInUrl(variant.id);
      } catch (e) {
        console.log('TC56 note: ' + e.message);
      }
      await Product.tapAddToCart();
      await Cart.waitForCount(1);
      const cart = await Cart.data();
      must(cart !== null, 'The store did not answer with cart data (too many requests? wait 20 minutes)');
      console.log('TC56 cart: ' + cart.items.map((i) => i.quantity + ' x ' + i.product_title + ' / ' + i.variant_title + ' / ' + i.price / 100).join(' ; '));
      must(cart.items.length === 1, 'The cart has ' + cart.items.length + ' lines (duplicate or wrong variant?)');
      const line = cart.items[0];
      must(line.quantity === 1, 'The cart quantity is ' + line.quantity);
      must(line.variant_id === variant.id, 'The cart has variant ' + line.variant_id + ' (' + line.variant_title + '), expected ' + variant.id + ' (' + shortName(variant) + ')');
      must(line.price === variant.price, 'The cart price is ' + Brush.money(line.price) + ', expected ' + Brush.money(variant.price));
      for (const word of site.brush.titleWords) must(line.product_title.toLowerCase().includes(word), 'Wrong product in the cart: ' + line.product_title);
      must(Boolean(line.image), 'The cart line has no image');
      await Cart.open();
      await browser.pause(1500);
      const text = await Cart.bodyText();
      must(text.includes(variant.option1), 'The cart page does not show "' + variant.option1 + '"');
      if (variant.option2) must(text.toLowerCase().includes(variant.option2.toLowerCase()), 'The cart page does not show "' + variant.option2 + '"');
      must(text.includes(Brush.money(variant.price)), 'The cart page does not show ' + Brush.money(variant.price));
      await Cart.expectNoSideScroll('TC56 cart');
      await Product.clearCart();
    });
  });


  describe('Reviews (Judge.me) - reading and opening the form only, never submitting', () => {
    it('TC30 (Mobile) the review widget is readable and does not cover other controls', async () => {
      await Product.open();
      const button = await Reviews.scrollToWidget();
      const box = await browser.execute((b) => { const r = b.getBoundingClientRect(); return { left: r.left, right: r.right, screenW: window.innerWidth }; }, button);
      must(box.left >= 0 && box.right <= box.screenW + 1, 'The "Write a review" button runs off the screen');
      must(await Reviews.isOnTop(button), 'Something covers the "Write a review" button: ' + (await Reviews.describeSpot(button)));
      console.log('TC30 review area text: ' + (await Reviews.widgetText(button)).slice(0, 200));
      await Store.expectNoSideScroll('TC30 reviews');
    });

    it('TC31 (Mobile) with no genuine reviews, an empty state shows and no sample reviews', async () => {
      await Product.open();
      const button = await Reviews.scrollToWidget();
      const text = await Reviews.widgetText(button);
      const live = await Reviews.liveReviewCount();
      console.log('TC31 live review elements: ' + live + '. Review area says: ' + text.slice(0, 250));
      must(text !== '', 'The review area shows no text at all');
      must(!/sample review|preview review|\(preview\)|demo review|example review/i.test(text), 'The review area looks like it shows sample reviews: ' + text.slice(0, 160));
      must(live === 0, live + ' review(s) are shown. If they are genuine customer reviews this is fine, otherwise remove them.');
    });

    it('TC32 (Mobile) Write a review opens the form (nothing is typed or sent)', async () => {
      await Product.open();
      const button = await Reviews.scrollToWidget();
      await Reviews.tap(button, 'Write a review');
      await browser.pause(1500);
      const text = await Reviews.bodyText();
      if (/already reviewed this product/i.test(text)) {
        console.log('TC32 the widget asked about writing another review; tapping "Not now"');
        const notNow = await $('//button[normalize-space(.)="Not now"]');
        if (await notNow.isExisting()) await notNow.click();
      } else {
        must((await Reviews.modalDisplayed()) || /your name|review title|rating/i.test(text), 'The review form did not open');
        const close = await $(locators.reviewModalClose);
        if (await close.isExisting()) await close.click();
        else await browser.keys('Escape');
        await browser.pause(800);
        must((await Reviews.modalDisplayed()) === false, 'The review form did not close');
      }
    });
  });

  describe('Cart', () => {
    it('TC35 (Mobile) the cart line shows title, variant, quantity, price and image', async () => {
      await Cart.addProduct();
      await Cart.open();
      await browser.pause(1500);
      const text = await Cart.bodyText();
      must(text.includes(site.product.title), 'The cart page does not show "' + site.product.title + '"');
      must(text.includes(site.product.variant), 'The cart line does not show the variant ' + site.product.variant);
      must(text.includes(site.product.price), 'The cart line does not show ' + site.product.price);
      const quantity = await Cart.quantityInput();
      must((await quantity.getValue()) === '1', 'The cart quantity is ' + (await quantity.getValue()));
      const imageOk = await browser.execute(() => Array.from(document.querySelectorAll('main img')).some((i) => i.complete && i.naturalWidth > 0 && i.getBoundingClientRect().width > 20));
      must(imageOk, 'No product image loaded in the cart');
      await Cart.expectNoSideScroll('TC35 cart');
    });

    it('TC36 (Mobile) quantity 1 to 2 and back recalculates the totals', async () => {
      await Cart.addProduct();
      await Cart.open();
      await Cart.tapQuantity('plus');
      await Cart.waitForCount(2);
      await browser.waitUntil(async () => (await Cart.bodyText()).includes('$39.98'), { timeout: 10000, timeoutMsg: 'The total did not become $39.98 with 2 items' });
      await Cart.tapQuantity('minus');
      await Cart.waitForCount(1);
      await browser.waitUntil(async () => !(await Cart.bodyText()).includes('$39.98'), { timeout: 10000, timeoutMsg: 'The total still shows $39.98 after going back to 1 item' });
      must((await Cart.bodyText()).includes(site.product.price), 'The price ' + site.product.price + ' is not shown after going back to 1 item');
    });

    it('TC37 (Mobile) removing the product shows the empty-cart state, also after reopening', async () => {
      await Cart.addProduct();
      await Cart.open();
      const how = await Cart.removeFirstLine();
      console.log('TC37 removed with the ' + how);
      await Cart.waitForCount(0);
      await Cart.expectEmptyState();
      await Cart.open();
      await Cart.expectEmptyState();
    });
  });

  describe('Live chat (Shopify Inbox)', () => {
    it('TC49 (Mobile) the chat bubble is visible, on screen and not covering key content', async () => {
      await Store.open('/');
      await Chat.expectBubbleOnScreen('TC49 home');
      await Product.open();
      const bubble = await Chat.expectBubbleOnScreen('TC49 product');
      const add = await Store.firstDisplayed('//button[@name="add"] | //button[contains(translate(normalize-space(.),"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"),"add to cart")]');
      await Store.jsScroll(add);
      const box = await browser.execute((b) => { const r = b.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; }, add);
      const now = await Chat.rectOf(await Chat.bubble());
      const w = Math.min(box.right, now.right) - Math.max(box.left, now.left);
      const h = Math.min(box.bottom, now.bottom) - Math.max(box.top, now.top);
      must(!(w > 2 && h > 2), 'The chat bubble covers the Add to cart button (' + Math.round(w) + 'x' + Math.round(h) + ' px)');
      void bubble;
    });

    it('TC50 (Mobile) the chat panel opens and closes without blocking the page', async () => {
      await Store.open('/');
      await Chat.open();
      const text = await Chat.settle(site.chat.greeting, 15);
      console.log('TC50 chat buttons: ' + (await Chat.listButtons()).join(' ; '));
      console.log('TC50 chat panel text: ' + text.slice(0, 300));
      if (text.includes(site.chat.greeting) === false) console.log('TC50 FINDING: the chat panel opened but its welcome text did not load in the Simulator');
      await Chat.close();
      await Chat.expectBubbleOnScreen('TC50 after closing');
      const y = await Store.scrollPage(500);
      must(y > 50, 'The page would not scroll after the chat closed (scrollY ' + y + ')');
      await Store.openMenu();
      await Store.closeMenuWithX();
    });

    it('TC51 (Mobile) suggested questions, message field and send control (sends only with CHAT_SEND=1)', async function () {
      await Store.open('/');
      await Chat.open();
      const chatText = await Chat.settle(site.chat.greeting, 15);
      const buttons = await Chat.listButtons();
      console.log('TC51 chat says: ' + chatText.slice(0, 300));
      if (chatText.includes(site.chat.greeting) === false) {
        try {
          await Chat.close();
        } catch (e) {
          console.log('TC51 note: ' + String(e.message).slice(0, 120));
        }
        console.log('TC51 SKIPPED: the chat content did not load in the Simulator, so there is nothing to test yet.');
        this.skip();
      }
      console.log('TC51 chat buttons: ' + buttons.join(' ; '));
      const field = await Chat.find('textarea, input[type="text"], [contenteditable="true"], [role="textbox"]');
      must(field !== null, 'The chat has no message field. Buttons seen: ' + buttons.join(' ; '));
      await Chat.tapRef(field, 'Message field');
      const focused = await browser.execute((f) => { const r = f.getRootNode(); return (r.activeElement || document.activeElement) === f; }, field);
      console.log('TC51 message field focused: ' + focused);
      if (process.env.CHAT_SEND === '1') {
        await Chat.type(field, 'Test message from the QA suite - please ignore.');
        const send = await Chat.find('button', 'send');
        must(send !== null, 'No Send control appeared after typing');
        await Chat.tapRef(send, 'Send');
        await browser.pause(3000);
      } else {
        console.log('TC51 nothing was typed or sent (set CHAT_SEND=1 to send one harmless test message)');
      }
      await Chat.close();
    });

    it('TC52 (Mobile) the privacy notice is readable and the panel fits the screen', async function () {
      await Store.open('/');
      await Chat.open();
      const text = await Chat.settle(site.chat.greeting, 15);
      console.log('TC52 chat text: ' + text.slice(0, 400));
      if (text.includes(site.chat.greeting) === false) {
        try {
          await Chat.close();
        } catch (e) {
          console.log('TC52 note: ' + String(e.message).slice(0, 120));
        }
        console.log('TC52 SKIPPED: the chat content did not load in the Simulator, so the privacy notice cannot be read yet.');
        this.skip();
      }
      must(/privacy|terms|\bAI\b|automated|assistant/i.test(text), 'No privacy or AI notice found in the chat panel text');
      const close = await Chat.find('button', 'close chat');
      const r = await Chat.rectOf(close);
      must(r.left >= 0 && r.right <= r.screenW + 1 && r.top >= 0 && r.bottom <= r.screenH + 1, 'The Close chat button is off the screen');
      console.log('TC52 screen ' + r.screenW + 'x' + r.screenH + '; the Simulator cannot be resized to 390 or 430 wide, those widths are tested in Playwright');
      await Chat.close();
    });
  });

  describeIf('CHECKOUT_TEST')('Checkout up to shipping (guarded: CHECKOUT_TEST=1). Made-up customer, no card, no Pay button', () => {
    after(async () => {
      await Product.clearCart();
    });

    it('TC38 (Mobile) required fields validate and errors are understandable', async () => {
      await Cart.addProduct();
      await Checkout.goFromCart();
      await Checkout.fill(['input[name="email"]', 'input#email', 'input[type="email"]'], 'not-an-email', 'Email');
      await browser.keys('Tab');
      await browser.pause(1500);
      const text = await Checkout.bodyText();
      must(/valid email|enter an email|email.*invalid|invalid.*email/i.test(text), 'No clear error for a bad email. Page says: ' + text.slice(0, 200));
      await Checkout.fillCustomer();
    });

    it('TC39 (Mobile) a valid address shows a shipping method with a price', async () => {
      await Cart.addProduct();
      await Checkout.goFromCart();
      await Checkout.fillCustomer();
      await browser.pause(3000);
      const text = await Checkout.bodyText();
      const at = text.search(/shipping method|shipping/i);
      console.log('TC39 shipping area: ' + text.slice(Math.max(0, at), Math.max(0, at) + 200));
      must(at >= 0 && (/\$\d/.test(text) || /free/i.test(text)), 'No shipping method with a price appeared');
    });

    it('TC41 (Mobile) the order summary matches the cart', async () => {
      await Cart.addProduct();
      await Checkout.goFromCart();
      await Checkout.fillCustomer();
      await browser.pause(3000);
      const text = await Checkout.bodyText();
      console.log('TC41 summary text: ' + text.slice(0, 500));
      must(text.includes(site.product.title) || text.toLowerCase().includes(site.product.titleWords), 'The summary does not show the product');
      must(text.includes(site.product.price), 'The summary does not show the product price ' + site.product.price);
      must(/total/i.test(text), 'The summary shows no total');
    });
  });
});
