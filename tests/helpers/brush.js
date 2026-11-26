// Helpers for the Silicone Pet Bath & Massage Brush (TC53 to TC56). Same logic as the Simulator's BrushPage.
// Choices are found by their words (like "Beige" or "Round shape"); the store's own product data says which
// combinations exist and which are sold out.
const { getJson } = require('./storefront');
const site = require('../data/site.json');

const norm = (s) => String(s === undefined || s === null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim();
const brushPath = '/products/' + site.brush.handle;
const money = (cents) => '$' + (cents / 100).toFixed(2);

async function product(page) {
  const data = await getJson(page, brushPath + '.js');
  data.options = data.options.map((o, i) => {
    if (typeof o !== 'string') return { name: o.name, values: o.values || [] };
    const values = [];
    for (const v of data.variants) if (v['option' + (i + 1)] && !values.includes(v['option' + (i + 1)])) values.push(v['option' + (i + 1)]);
    return { name: o, values };
  });
  return data;
}

// Which option group a wanted word belongs to. Exact match first, then a close match.
function resolve(prod, wanted) {
  const w = norm(wanted);
  const groups = prod.options.map((o, index) => ({ index, name: o.name, values: o.values }));
  const tests = [(v) => norm(v) === w, (v) => norm(v).startsWith(w), (v) => norm(v) !== '' && w.includes(norm(v))];
  for (const test of tests) {
    for (const g of groups) {
      const hit = g.values.find(test);
      if (hit !== undefined) return { index: g.index, name: g.name, value: hit };
    }
  }
  return null;
}

function describeOptions(prod) {
  return prod.options.map((o) => o.name + ': ' + o.values.join(' | ')).join('  //  ');
}

function variantFor(prod, values) {
  return prod.variants.find((v) => values.every((val) => [v.option1, v.option2, v.option3].some((o) => norm(o) === norm(val)))) || null;
}

function variantById(prod, id) {
  return prod.variants.find((v) => String(v.id) === String(id)) || null;
}

function colorValues(prod) {
  const g = prod.options.find((o) => /colou?r/i.test(o.name || '')) || prod.options[0];
  return g.values;
}

// The variant for a pair of wanted words from site.json (for example ["Beige", "Round shape"]).
function comboVariant(prod, combo) {
  const first = resolve(prod, combo[0]);
  const second = resolve(prod, combo[1]);
  if (first === null || second === null) return { error: 'Cannot match ' + combo.join(' + ') + ' with the store options. They are: ' + describeOptions(prod) };
  const variant = variantFor(prod, [first.value, second.value]);
  if (variant === null) return { error: 'The store has no variant ' + first.value + ' + ' + second.value };
  return { first: first.value, second: second.value, variant };
}

async function open(page) {
  await page.goto(brushPath);
  await page.waitForTimeout(800);
}

// Finds the choice that has these words and clicks it. Returns what it did.
async function choose(page, wanted) {
  const found = await page.evaluate((w0) => {
    const norm = (s) => String(s === undefined || s === null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim();
    const w = norm(w0);
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    document.querySelectorAll('[data-qa-opt]').forEach((e) => e.removeAttribute('data-qa-opt'));
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
      target.setAttribute('data-qa-opt', '1');
      return { kind: 'radio', disabled: input.disabled, tagged: true };
    }
    const pool = Array.from(scope.querySelectorAll('button, label, a, [role="radio"], [role="button"], li')).filter(visible);
    const hit = pool.find((el) => [el.innerText, el.getAttribute('aria-label'), el.getAttribute('title'), el.getAttribute('data-value')].some((t) => norm(t) === w));
    if (hit) {
      hit.setAttribute('data-qa-opt', '1');
      return { kind: 'button', disabled: hit.disabled === true || hit.getAttribute('aria-disabled') === 'true', tagged: true };
    }
    return { kind: 'none', tagged: false, seen: pool.slice(0, 25).map((e) => norm(e.innerText || e.getAttribute('aria-label'))).filter(Boolean) };
  }, wanted);
  if (found.kind === 'none') throw new Error('Cannot find the choice "' + wanted + '" on the page. Choices seen: ' + found.seen.join(' | '));
  if (found.tagged) {
    const el = page.locator('[data-qa-opt="1"]').first();
    await el.scrollIntoViewIfNeeded();
    await el.click({ timeout: 8000 });
  }
  await page.waitForTimeout(900);
  return found;
}

// What the page shows now: chosen words, the picture on screen, price text and the Add to cart button.
async function state(page) {
  return page.evaluate(() => {
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
      image,
      add,
      price: priceMatch ? priceMatch[0].replace(/\s/g, '') : '',
      pickerText: norm(picker.innerText),
      variantParam: new URL(location.href).searchParams.get('variant'),
    };
  });
}

function addIsReady(st) {
  return st.add.found && /add to cart/.test(st.add.text) && st.add.disabled === false;
}

async function isChosen(page, prod, word) {
  const st = await state(page);
  if (st.picked.some((p) => norm(p) === norm(word))) return true;
  const v = st.variantParam ? variantById(prod, st.variantParam) : null;
  return v !== null && [v.option1, v.option2, v.option3].some((o) => norm(o) === norm(word));
}

module.exports = { brushPath, money, product, resolve, describeOptions, variantFor, variantById, colorValues, comboVariant, open, choose, state, addIsReady, isChosen };
