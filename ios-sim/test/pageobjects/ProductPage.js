// The Mini Reusable Pet Hair Remover page: gallery swipe and Add to cart.
import BasePage from './BasePage.js';
import { site } from '../data/site.js';

class ProductPage extends BasePage {
  async open() {
    await browser.url('/products/' + site.product.handle);
  }

  // Marks the sideways-scrolling picture strip so it can be found again. Returns false if there is none.
  async tagGallery() {
    return browser.execute(() => {
      const imgs = Array.from(document.querySelectorAll('main img')).filter((i) => {
        const r = i.getBoundingClientRect();
        return r.width > 100 && r.height > 100;
      });
      for (const img of imgs) {
        for (let el = img.parentElement; el !== null && el !== document.body; el = el.parentElement) {
          const ox = getComputedStyle(el).overflowX;
          if ((ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth + 1) {
            el.setAttribute('data-sim-gallery', '1');
            return true;
          }
        }
      }
      return false;
    });
  }

  async galleryPosition() {
    return browser.execute(() => {
      const g = document.querySelector('[data-sim-gallery="1"]');
      return g === null ? -1 : g.scrollLeft;
    });
  }

  // A real finger swipe from right to left across the picture strip.
  // Tries once at the plain position and once shifted down by Safari's top bar, because
  // Safari can place its address bar either at the top or at the bottom of the screen.
  async swipeGalleryLeft() {
    if ((await this.tagGallery()) === false) throw new Error('No sideways-scrolling picture gallery found on the product page');
    const gallery = await $('[data-sim-gallery="1"]');
    await gallery.scrollIntoView({ block: 'center' });
    const before = await this.galleryPosition();
    const tried = [];
    for (const shifted of [false, true]) {
      const rect = await browser.execute((g) => {
        const r = g.getBoundingClientRect();
        return { x: r.left, y: r.top, w: r.width, h: r.height, bar: Math.max(0, window.screen.height - window.innerHeight) };
      }, gallery);
      const y = Math.round(rect.y + rect.h / 2 + (shifted ? rect.bar : 0));
      const fromX = Math.round(rect.x + rect.w * 0.8);
      const toX = Math.round(rect.x + rect.w * 0.2);
      await browser
        .action('pointer', { parameters: { pointerType: 'touch' } })
        .move({ x: fromX, y })
        .down()
        .pause(150)
        .move({ duration: 500, x: toX, y })
        .up()
        .perform();
      await browser.pause(800);
      const after = await this.galleryPosition();
      tried.push((shifted ? 'shifted y=' : 'plain y=') + y + ' moved ' + (after - before) + 'px');
      if (after - before > 10) return { moved: after - before, how: tried[tried.length - 1] };
    }
    throw new Error('The swipe did not move the gallery. Tried: ' + tried.join('; '));
  }

  async clearCart() {
    await browser.executeAsync((done) => {
      fetch('/cart/clear.js', { method: 'POST' }).then(
        () => done(true),
        () => done(false)
      );
    });
  }

  // How many items are in the cart (-1 if the store did not answer with cart data).
  async cartCount() {
    return browser.executeAsync((done) => {
      fetch('/cart.js')
        .then((r) => r.text())
        .then(
          (text) => {
            try {
              done(JSON.parse(text).item_count);
            } catch (e) {
              done(-1);
            }
          },
          () => done(-1)
        );
    });
  }

  // Taps the first Add to cart button that is visible. Tries a tap even if the cover check is unsure.
  async tapAddToCart() {
    const lower = "translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz')";
    const buttons = await $$(
      '//button[contains(' + lower + ',"add to cart")] | //form[contains(@action,"/cart/add")]//button[@type="submit"] | //button[@name="add"]'
    );
    const notes = [];
    let fallback = null;
    for (const button of buttons) {
      if ((await button.isDisplayed()) === false) {
        notes.push('one button is hidden');
        continue;
      }
      try {
        await button.scrollIntoView({ block: 'center' });
      } catch (e) {
        // not scrollable; the check below decides
      }
      if (await this.isOnTop(button)) {
        await button.click();
        return;
      }
      if (fallback === null) fallback = button;
      notes.push(await this.describeSpot(button));
    }
    if (fallback !== null) {
      console.log('WARNING: Add to cart looked covered (' + notes.join(' | ') + '); tapping it anyway');
      await fallback.click();
      return;
    }
    const pageText = await $('body').getText();
    throw new Error(
      'No Add to cart button could be tapped. Buttons found: ' + buttons.length + '. ' + notes.join(' | ') +
        '. Page says "Add to cart": ' + (/add to cart/i.test(pageText) ? 'yes' : 'no') + ', "Sold out": ' + (/sold out/i.test(pageText) ? 'yes' : 'no')
    );
  }
}

export default new ProductPage();
