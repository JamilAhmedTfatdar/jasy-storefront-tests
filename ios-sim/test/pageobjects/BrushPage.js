// The Silicone Pet Bath & Massage Brush: color and style choices, sold-out combinations and Add to cart.
// Choices are found by their words (like "Beige" or "Round shape"), so the page markup can change.
// The product data comes from the store's own /products/<handle>.js, so the tests know which combinations exist.
import BasePage from './BasePage.js';
import { site } from '../data/site.js';

const norm = (s) => String(s === undefined || s === null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim();

class BrushPage extends BasePage {
  async open(query = '') {
    await browser.url('/products/' + site.brush.handle + query);
    await browser.pause(800);
  }

  // The product as the store describes it (retries because Shopify sometimes answers "too many requests").
  async product() {
    for (let attempt = 0; attempt < 4; attempt++) {
      const data = await browser.executeAsync((handle, done) => {
        fetch('/products/' + handle + '.js')
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
      }, site.brush.handle);
      if (data !== null) {
        // Older stores list option names only; build the values from the variants.
        data.options = data.options.map((o, i) => {
          if (typeof o !== 'string') return { name: o.name, values: o.values || [] };
          const values = [];
          for (const v of data.variants) if (v['option' + (i + 1)] && !values.includes(v['option' + (i + 1)])) values.push(v['option' + (i + 1)]);
          return { name: o, values };
        });
        return data;
      }
      await browser.pause(4000);
    }
    return null;
  }

  // Finds which option group a wanted word belongs to. Exact match first, then a close match.
  resolve(product, wanted) {
    const w = norm(wanted);
    const groups = product.options.map((o, index) => ({ index, name: o.name || o, values: o.values || [] }));
    const tests = [(v) => norm(v) === w, (v) => norm(v).startsWith(w), (v) => w.includes(norm(v)) && norm(v) !== ''];
    for (const test of tests) {
      for (const g of groups) {
        const hit = g.values.find(test);
        if (hit !== undefined) return { index: g.index, name: g.name, value: hit };
      }
    }
    return null;
  }

  describeOptions(product) {
    return product.options.map((o) => (o.name || o) + ': ' + (o.values || []).join(' | ')).join('  //  ');
  }

  // The variant that has all of these option values (a list of option values as written on the page).
  variantFor(product, values) {
    return (
      product.variants.find((v) => values.every((val) => [v.option1, v.option2, v.option3].some((o) => norm(o) === norm(val)))) || null
    );
  }

  variantById(product, id) {
    return product.variants.find((v) => String(v.id) === String(id)) || null;
  }

  money(cents) {
    return '$' + (cents / 100).toFixed(2);
  }

  // Values of the option group that is called color (or the first group).
  colorValues(product) {
    const g = product.options.find((o) => /colou?r/i.test(o.name || '')) || product.options[0];
    return g.values || [];
  }

  // Finds the choice that has these words and taps it. Returns what it did.
  async choose(wanted) {
    const found = await browser.execute((w0) => {
      const norm = (s) => String(s === undefined || s === null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim();
      const w = norm(w0);
      const visible = (el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      document.querySelectorAll('[data-sim-opt]').forEach((e) => e.removeAttribute('data-sim-opt'));
      const scope = document.querySelector('variant-picker') || document.querySelector('product-form-component') || document.querySelector('main') || document.body;
      for (const sel of scope.querySelectorAll('select')) {
        const opt = Array.from(sel.options).find((o) => norm(o.text) === w || norm(o.value) === w);
        if (opt) {
          sel.value = opt.value;
          sel.dispatchEvent(new Event('input', { bubbles: true }));
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          return { kind: 'dropdown', disabled: opt.disabled, tagged: false };
        }
      }
      for (const input of scope.querySelectorAll('input[type="radio"]')) {
        if (norm(input.value) !== w) continue;
        const label = input.id ? scope.querySelector('label[for="' + CSS.escape(input.id) + '"]') : null;
        const wrap = label || input.closest('label');
        const target = wrap && visible(wrap) ? wrap : visible(input) ? input : wrap || input;
        target.setAttribute('data-sim-opt', '1');
        return { kind: 'radio', disabled: input.disabled, tagged: true };
      }
      const pool = Array.from(scope.querySelectorAll('button, label, a, [role="radio"], [role="button"], li')).filter(visible);
      const hit = pool.find((el) => [el.innerText, el.getAttribute('aria-label'), el.getAttribute('title'), el.getAttribute('data-value')].some((t) => norm(t) === w));
      if (hit) {
        hit.setAttribute('data-sim-opt', '1');
        return { kind: 'button', disabled: hit.disabled === true || hit.getAttribute('aria-disabled') === 'true', tagged: true };
      }
      return { kind: 'none', tagged: false, seen: pool.slice(0, 25).map((e) => norm(e.innerText || e.getAttribute('aria-label'))).filter(Boolean) };
    }, wanted);
    if (found.kind === 'none') throw new Error('Cannot find the choice "' + wanted + '" on the page. Choices seen: ' + found.seen.join(' | '));
    if (found.tagged) {
      const el = await $('[data-sim-opt="1"]');
      await this.tap(el, wanted);
    }
    await browser.pause(900);
    return found;
  }

  // The variant number in the page address (null if the address has none).
  async urlVariant() {
    const url = new URL(await browser.getUrl());
    return url.searchParams.get('variant');
  }

  async waitForVariantInUrl(id, timeout = 8000) {
    await browser.waitUntil(async () => String(await this.urlVariant()) === String(id), {
      timeout,
      timeoutMsg: 'The page address never changed to variant ' + id + ' (it is ' + (await browser.getUrl()) + ')',
    });
  }

  // What the page shows now: chosen words, the picture on screen, price text and the Add to cart button.
  async state() {
    return browser.execute(() => {
      const norm = (s) => String(s === undefined || s === null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim();
      const visible = (el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      const picker = document.querySelector('variant-picker') || document.querySelector('main') || document.body;
      const picked = Array.from(picker.querySelectorAll('input[type="radio"]:checked')).map((i) => i.value);
      for (const s of picker.querySelectorAll('select')) picked.push(s.value);
      for (const e of picker.querySelectorAll('[aria-checked="true"], [aria-pressed="true"], [aria-selected="true"]')) {
        const t = (e.innerText || e.getAttribute('aria-label') || '').trim();
        if (t) picked.push(t);
      }
      const disabledChoices = Array.from(picker.querySelectorAll('input[type="radio"]:disabled')).map((i) => i.value);
      let image = '';
      let best = 0;
      for (const img of document.querySelectorAll('main img')) {
        const r = img.getBoundingClientRect();
        const w = Math.min(r.right, window.innerWidth) - Math.max(r.left, 0);
        const h = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
        if (r.width > 150 && w > 0 && h > 0 && w * h > best) {
          best = w * h;
          image = (img.currentSrc || img.src || '').split('?')[0];
        }
      }
      let add = { found: false, text: '', disabled: false };
      const buttons = Array.from(document.querySelectorAll('button')).filter((b) => visible(b) && /add to cart|sold out|unavailable|out of stock|notify/i.test(b.innerText));
      if (buttons.length > 0) {
        const b = buttons[0];
        add = { found: true, text: norm(b.innerText), disabled: b.disabled === true || b.getAttribute('aria-disabled') === 'true' };
      }
      const priceMatch = (document.querySelector('main') || document.body).innerText.match(/\$\s?\d[\d,]*\.\d\d/);
      return {
        picked,
        disabledChoices,
        image,
        add,
        price: priceMatch ? priceMatch[0].replace(/\s/g, '') : '',
        pickerText: norm(picker.innerText),
        variantParam: new URL(location.href).searchParams.get('variant'),
      };
    });
  }

  addIsReady(state) {
    return state.add.found && /add to cart/.test(state.add.text) && state.add.disabled === false;
  }

  // True when this word shows as chosen on the page, or the page address points to a variant that has it.
  async isChosen(product, word) {
    const state = await this.state();
    if (state.picked.some((p) => norm(p) === norm(word))) return true;
    const v = state.variantParam ? this.variantById(product, state.variantParam) : null;
    return v !== null && [v.option1, v.option2, v.option3].some((o) => norm(o) === norm(word));
  }
}

export default new BrushPage();
