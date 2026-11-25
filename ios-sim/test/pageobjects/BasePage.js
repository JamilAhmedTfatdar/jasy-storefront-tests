// Shared behavior for every page object.

export default class BasePage {
  async open(path = '/') {
    await browser.url(path);
  }

  async isAnyDisplayed(selector) {
    for (const el of await $$(selector)) {
      if (await el.isDisplayed()) return true;
    }
    return false;
  }

  async firstDisplayed(selector) {
    for (const el of await $$(selector)) {
      if (await el.isDisplayed()) return el;
    }
    throw new Error('Nothing visible matches ' + selector);
  }

  // True when this element is the one a finger would touch at its center,
  // so nothing (like an open menu or a banner) lies on top of it.
  async isOnTop(el) {
    return browser.execute((target) => {
      const r = target.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      if (r.width === 0 || r.height === 0 || x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return false;
      const top = document.elementFromPoint(x, y);
      return top === target || target.contains(top);
    }, el);
  }

  // Says where an element is and what sits on top of its center (used in error messages).
  async describeSpot(el) {
    return browser.execute((target) => {
      const r = target.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      const label = (n) => (n ? n.tagName.toLowerCase() + (typeof n.className === 'string' && n.className.trim() !== '' ? '.' + n.className.trim().split(/\s+/)[0] : '') : 'nothing');
      return 'box ' + Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' on a ' + window.innerWidth + 'x' + window.innerHeight + ' screen, covered by ' + label(top);
    }, el);
  }

  // Taps the first link with exactly this text that is really on top.
  // Pass a scope (like the footer) to look only inside it.
  async tapLinkNamed(name, scope) {
    const xpath = (scope ? './/' : '//') + 'a[normalize-space(.)="' + name + '"]';
    const links = scope ? await scope.$$(xpath) : await $$(xpath);
    const notes = [];
    let fallback = null;
    for (const link of links) {
      try {
        await link.scrollIntoView({ block: 'center' });
      } catch (e) {
        // not scrollable; the checks below decide
      }
      if ((await link.isDisplayed()) && (await this.isOnTop(link))) {
        await link.click();
        return;
      }
      if (fallback === null && (await link.isDisplayed())) fallback = link;
      notes.push(await this.describeSpot(link));
    }
    if (fallback !== null) {
      console.log('WARNING: "' + name + '" looked covered (' + notes.join(' | ') + '); tapping it anyway');
      await fallback.click();
      return;
    }
    throw new Error('Nothing to tap for "' + name + '". Links with that name: ' + links.length + '. ' + notes.join(' | '));
  }

  async waitForUrlToContain(fragment, timeout = 15000) {
    await browser.waitUntil(async () => (await browser.getUrl()).includes(fragment), {
      timeout,
      timeoutMsg: 'The address never contained "' + fragment + '"',
    });
  }
}
