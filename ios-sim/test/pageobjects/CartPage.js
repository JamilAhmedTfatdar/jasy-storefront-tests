// The cart: reading it, adding the product through the page, changing quantity, removing.
import BasePage from './BasePage.js';
import Product from './ProductPage.js';
import { must } from '../helpers/must.js';

class CartPage extends BasePage {
  async open() {
    await browser.url('/cart');
  }

  // The cart as the store reports it (retries a few times because Shopify sometimes answers "too many requests").
  async data() {
    for (let attempt = 0; attempt < 4; attempt++) {
      const cart = await browser.executeAsync((done) => {
        fetch('/cart.js')
          .then((r) => r.text())
          .then(
            (text) => {
              try {
                done(JSON.parse(text));
              } catch (e) {
                done(null);
              }
            },
            () => done(null)
          );
      });
      if (cart !== null) return cart;
      await browser.pause(4000);
    }
    return null;
  }

  async waitForCount(count, timeout = 20000) {
    await browser.waitUntil(async () => (await Product.cartCount()) === count, {
      timeout,
      timeoutMsg: 'The cart did not get to ' + count + ' item(s)',
    });
  }

  // Empties the cart, opens the product page, taps Add to cart and waits for 1 item.
  async addProduct() {
    await Product.open();
    await Product.clearCart();
    await Product.tapAddToCart();
    await this.waitForCount(1);
  }

  async quantityInput() {
    return this.firstDisplayed('input[name="updates[]"], cart-items-component input[type="number"], main input[type="number"]');
  }

  // The plus and minus buttons sit next to the quantity box. They are found from the box, whatever their labels are.
  async tapQuantity(kind) {
    const result = await browser.execute(() => {
      const input = Array.from(document.querySelectorAll('input[name="updates[]"], cart-items-component input[type="number"], main input[type="number"]')).find((i) => i.getBoundingClientRect().width > 0);
      if (!input) return 'no visible quantity box';
      let box = input.parentElement;
      for (let up = 0; up < 5 && box; up++, box = box.parentElement) {
        const buttons = Array.from(box.querySelectorAll('button'))
          .filter((b) => b.getBoundingClientRect().width > 0 && !/remove/i.test((b.getAttribute('aria-label') || '') + ' ' + b.innerText))
          .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
        if (buttons.length >= 2) {
          document.querySelectorAll('[data-sim-qty]').forEach((e) => e.removeAttribute('data-sim-qty'));
          buttons[0].setAttribute('data-sim-qty', 'minus');
          buttons[buttons.length - 1].setAttribute('data-sim-qty', 'plus');
          return 'ok';
        }
      }
      return 'no plus and minus buttons next to the quantity box';
    });
    if (result !== 'ok') throw new Error('Cart quantity buttons: ' + result);
    const button = await $('[data-sim-qty="' + kind + '"]');
    await this.tap(button, kind === 'plus' ? 'Increase quantity' : 'Decrease quantity');
  }

  // Taps Remove on the first cart line. Returns how it was removed.
  async removeFirstLine() {
    const remove = await $$('//*[self::button or self::a][contains(@aria-label,"Remove") or normalize-space(.)="Remove"]');
    for (const el of remove) {
      if (await el.isDisplayed()) {
        await this.tap(el, 'Remove');
        return 'Remove button';
      }
    }
    await this.tapQuantity('minus');
    return 'minus button (no Remove button was found)';
  }

  async expectEmptyState() {
    await browser.waitUntil(async () => /your cart is empty/i.test(await this.bodyText()), {
      timeout: 15000,
      timeoutMsg: 'The cart did not show "Your cart is empty"',
    });
    must((await Product.cartCount()) === 0, 'The page says empty but the store still reports items in the cart');
  }
}

export default new CartPage();
