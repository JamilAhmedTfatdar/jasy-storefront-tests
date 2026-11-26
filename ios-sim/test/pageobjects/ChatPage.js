// The Shopify Inbox live chat. The chat widget lives inside a shadow root, so these helpers look inside shadow roots too.
import BasePage from './BasePage.js';
import { must } from '../helpers/must.js';

class ChatPage extends BasePage {
  // The first visible element matching the CSS selector whose label or text contains `label` (any case). Looks inside shadow roots.
  async find(selector, label = '') {
    return browser.execute(
      (sel, lab) => {
        const hits = [];
        const walk = (root) => {
          for (const el of root.querySelectorAll(sel)) hits.push(el);
          for (const el of root.querySelectorAll('*')) if (el.shadowRoot) walk(el.shadowRoot);
        };
        walk(document);
        const text = (e) => ((e.getAttribute('aria-label') || '') + ' ' + (e.innerText || e.textContent || '')).trim().toLowerCase();
        const shown = hits.filter((e) => {
          const r = e.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        const match = lab === '' ? shown : shown.filter((e) => text(e).includes(lab.toLowerCase()));
        return match.length > 0 ? match[0] : null;
      },
      selector,
      label
    );
  }

  // All visible buttons inside the chat (label and size), to print what the widget really offers.
  async listButtons() {
    return browser.execute(() => {
      const out = [];
      const walk = (root) => {
        for (const el of root.querySelectorAll('button, [role="button"], a')) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            const label = ((el.getAttribute('aria-label') || '') + ' | ' + (el.innerText || el.textContent || '')).replace(/\s+/g, ' ').trim().slice(0, 60);
            out.push(label + ' [' + Math.round(r.width) + 'x' + Math.round(r.height) + ']');
          }
        }
        for (const el of root.querySelectorAll('*')) if (el.shadowRoot) walk(el.shadowRoot);
      };
      const host = document.querySelector('shopify-chat');
      if (host !== null && host.shadowRoot) walk(host.shadowRoot);
      return out;
    });
  }

  // All text inside the chat widget's shadow roots.
  async text() {
    return browser.execute(() => {
      const parts = [];
      const collect = (root) => {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const n = walker.currentNode;
          const tag = n.parentElement ? n.parentElement.tagName : '';
          if (tag !== 'STYLE' && tag !== 'SCRIPT' && n.textContent.trim() !== '') parts.push(n.textContent.trim());
        }
        for (const el of root.querySelectorAll('*')) if (el.shadowRoot) collect(el.shadowRoot);
      };
      const host = document.querySelector('shopify-chat');
      if (host !== null) {
        collect(host);
        if (host.shadowRoot) collect(host.shadowRoot);
      }
      return parts.join(' ').replace(/\s+/g, ' ');
    });
  }

  async rectOf(ref) {
    return browser.execute((e) => {
      const r = e.getBoundingClientRect();
      return { left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom), width: Math.round(r.width), height: Math.round(r.height), screenW: window.innerWidth, screenH: window.innerHeight };
    }, ref);
  }

  // Waits for an element to appear (the chat loads a few seconds after the page).
  async waitFor(selector, label, timeout = 25000) {
    let found = null;
    await browser.waitUntil(
      async () => {
        found = await this.find(selector, label);
        return found !== null;
      },
      { timeout, interval: 1000, timeoutMsg: 'The chat never showed ' + selector + ' "' + label + '". It shows these buttons: ' + (await this.listButtons()).join(' ; ') }
    );
    return found;
  }

  // The innermost visible element whose text or label contains `label` (any case). Looks inside shadow roots.
  async findText(label) {
    return browser.execute((lab) => {
      const all = [];
      const walk = (root) => {
        for (const el of root.querySelectorAll('*')) {
          all.push(el);
          if (el.shadowRoot) walk(el.shadowRoot);
        }
      };
      walk(document);
      const want = lab.toLowerCase();
      const text = (e) => ((e.getAttribute('aria-label') || '') + ' ' + (e.innerText || e.textContent || '')).replace(/\s+/g, ' ').trim().toLowerCase();
      const shown = all.filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && text(e).includes(want);
      });
      const inner = shown.filter((e) => !shown.some((o) => o !== e && e.contains(o)));
      return inner.length > 0 ? inner[0] : null;
    }, label);
  }

  // Goes past the sign-in screen ("Continue without signing in") and waits until the chat shows its welcome text.
  // If the chat says it is not available it taps "Try again" once. Returns the chat text at the end.
  async settle(greeting, seconds = 30) {
    const skip = await this.findText('continue without signing in');
    if (skip !== null) {
      console.log('Chat: tapping "Continue without signing in"');
      await this.tapRef(skip, 'Continue without signing in');
    }
    let retried = false;
    const end = Date.now() + seconds * 1000;
    while (Date.now() < end) {
      const text = await this.text();
      if (text.includes(greeting)) return text;
      if (retried === false && /isn.t available right now/i.test(text)) {
        const again = await this.findText('try again');
        if (again !== null) {
          console.log('Chat: it said it was not available; tapping "Try again"');
          await this.tapRef(again, 'Try again');
          retried = true;
        }
      }
      await browser.pause(1500);
    }
    return this.text();
  }

  async bubble() {
    return this.waitFor('button', 'chat');
  }

  // Taps an element found inside the chat. Falls back to a script click if the browser cannot tap it directly.
  async tapRef(ref, name) {
    try {
      const el = await $(ref);
      await el.click();
    } catch (e) {
      console.log('WARNING: "' + name + '" could not be tapped directly (' + String(e.message).slice(0, 80) + '); used a script click');
      await browser.execute((x) => x.click(), ref);
    }
  }

  // Types into a chat field (only used when CHAT_SEND=1).
  async type(ref, text) {
    try {
      const el = await $(ref);
      await el.setValue(text);
    } catch (e) {
      await browser.execute(
        (x, t) => {
          x.focus();
          if ('value' in x) x.value = t;
          else x.textContent = t;
          x.dispatchEvent(new Event('input', { bubbles: true }));
        },
        ref,
        text
      );
    }
  }

  async open() {
    const bubble = await this.bubble();
    await this.tapRef(bubble, 'Chat');
    await this.waitFor('button', 'close chat');
    await browser.pause(1200);
  }

  async close() {
    const isOpen = async () => (await this.find('button', 'close chat')) !== null;
    if (!(await isOpen())) {
      console.log('Chat: the panel is already closed');
      return;
    }
    const attempts = [
      ['tap', async (ref) => this.tapRef(ref, 'Close chat')],
      ['script click', async (ref) => browser.execute((x) => x.click(), ref)],
      ['Escape key', async () => browser.keys(['Escape'])],
    ];
    for (const [name, act] of attempts) {
      const ref = await this.find('button', 'close chat');
      if (ref === null) break;
      try {
        await act(ref);
      } catch (e) {
        console.log('Chat: closing by ' + name + ' failed (' + String(e.message).slice(0, 80) + ')');
      }
      await browser.pause(2500);
      if (!(await isOpen())) {
        console.log('Chat: closed by ' + name);
        await browser.pause(800);
        return;
      }
    }
    throw new Error('The chat panel did not close (tried tap, script click and Escape). Buttons now: ' + (await this.listButtons()).join(' ; '));
  }

  async expectBubbleOnScreen(label) {
    const bubble = await this.bubble();
    const r = await this.rectOf(bubble);
    console.log(label + ': chat bubble ' + r.width + 'x' + r.height + ' at ' + r.left + ',' + r.top + ' on a ' + r.screenW + 'x' + r.screenH + ' screen');
    must(r.left >= 0 && r.top >= 0 && r.right <= r.screenW + 1 && r.bottom <= r.screenH + 1, label + ': the chat bubble is partly off the screen');
    return r;
  }
}

export default new ChatPage();
