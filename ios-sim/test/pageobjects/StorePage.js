// Home page, phone menu, footer and the password page.
import BasePage from './BasePage.js';
import { locators } from '../locators/store.locators.js';
import { must } from '../helpers/must.js';

class StorePage extends BasePage {
  // While the store shows "Opening soon", enter the preview password from the environment.
  async unlockIfLocked() {
    await browser.url('/');
    if ((await browser.getUrl()).includes('/password') === false) return;
    const password = process.env.STOREFRONT_PASSWORD;
    if (password === undefined || password === '') {
      throw new Error('The store is locked. In this Terminal run first: read -s "STOREFRONT_PASSWORD?Storefront password: "; export STOREFRONT_PASSWORD');
    }
    const field = await $(locators.passwordInput);
    if ((await field.isDisplayed()) === false) {
      const lower = "translate(normalize-space(text()),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz')";
      const openers = await $$('//*[contains(' + lower + ',"enter") and contains(' + lower + ',"password")]');
      for (const opener of openers) {
        if (await opener.isDisplayed()) {
          await opener.click();
          break;
        }
      }
    }
    try {
      await field.waitForDisplayed({ timeout: 10000 });
    } catch (e) {
      const shown = (await $('body').getText()).replace(/\s+/g, ' ').slice(0, 200);
      throw new Error('The password field did not appear. The page shows: ' + shown);
    }
    // Show dots but make it a plain text box, so iOS does not pop up "Save Password?" and freeze the page.
    await browser.execute((el) => {
      el.type = 'text';
      el.style.webkitTextSecurity = 'disc';
      el.setAttribute('autocomplete', 'off');
    }, field);
    await field.setValue(password);
    const unlocked = async () => (await browser.getUrl()).includes('/password') === false;
    await browser.execute((el) => {
      if (el.form === null) return;
      if (el.form.requestSubmit) el.form.requestSubmit();
      else el.form.submit();
    }, field);
    await browser.pause(2000);
    const sheetDismissed = await this.dismissSavePasswordSheet();
    try {
      await browser.waitUntil(unlocked, { timeout: 10000 });
    } catch (e) {
      // The form did not go through; try the Enter key.
      await browser.keys('Enter');
    }
    try {
      await browser.waitUntil(unlocked, { timeout: 15000 });
    } catch (e) {
      let typedLength = '?';
      let typedMatches = '?';
      try {
        const typed = await field.getValue();
        typedLength = typed.length;
        typedMatches = typed === password ? 'yes' : 'no';
      } catch (e2) {
        // the page already changed
      }
      const text = (await $('body').getText()).replace(/\s+/g, ' ');
      // Keep the phone on this page for a moment so you can look at it or take a screenshot.
      await browser.pause(20000);
      const pageUrl = await browser.getUrl();
      const errorWords = /incorrect|wrong|invalid|try again/i.test(text) ? 'yes' : 'no';
      throw new Error(
        'The store stayed locked. Typed ' + typedLength + ' of ' + password.length + ' characters, text matches: ' + typedMatches +
          '. Save-password sheet tapped: ' + sheetDismissed + '. Page address: ' + pageUrl + '. Error words on page: ' + errorWords +
          '. End of the page text: ' + text.slice(-120)
      );
    }
  }

  // iOS can show a "Save Password?" sheet over Safari. Tap "Not Now" if it is there, then go back to the web page.
  async dismissSavePasswordSheet() {
    let result = 'no';
    let webContext = null;
    try {
      webContext = await browser.getContext();
      await browser.switchContext('NATIVE_APP');
      const notNow = await $('-ios predicate string:label == "Not Now" AND visible == 1');
      if (await notNow.isExisting()) {
        await notNow.click();
        result = 'yes';
      }
    } catch (e) {
      result = 'error';
    }
    try {
      if (webContext !== null) await browser.switchContext(webContext);
    } catch (e) {
      // stay in the current view
    }
    return result;
  }

  async openMenu() {
    const button = await this.firstDisplayed(locators.menuButton);
    await button.click();
    await browser.waitUntil(() => this.isAnyDisplayed(locators.menuClose), { timeout: 8000, timeoutMsg: 'The menu did not open' });
    await browser.pause(800);
  }

  async closeMenuWithX() {
    const close = await this.firstDisplayed(locators.menuClose);
    await close.click();
    await browser.waitUntil(async () => (await this.isAnyDisplayed(locators.menuClose)) === false, {
      timeout: 8000,
      timeoutMsg: 'The menu did not close with X',
    });
  }

  async tapMenuLink(name) {
    await this.tapLinkNamed(name);
  }

  // The size of every link in the open phone menu, to check that nothing is clipped.
  async drawerReport() {
    return browser.execute((css) => {
      return Array.from(document.querySelectorAll(css))
        .map((a) => {
          const r = a.getBoundingClientRect();
          return { id: a.id, text: (a.innerText || '').trim(), width: Math.round(r.width), height: Math.round(r.height), right: Math.round(r.right), clipped: a.scrollWidth > a.clientWidth + 1, screenW: window.innerWidth };
        })
        .filter((x) => x.width > 0 && x.height > 0);
    }, locators.drawerLinks);
  }

  // Taps one phone-menu link by its id (for example "HeaderDrawer-about-us").
  async tapDrawerLink(id) {
    const link = await $('#' + id);
    await link.waitForExist({ timeout: 8000, timeoutMsg: 'The menu has no link with id ' + id });
    await this.tap(link, id);
  }

  async search(keyword) {
    const button = await this.headerButton('Search');
    await this.tap(button, 'Search');
    await browser.waitUntil(() => this.isAnyDisplayed(locators.searchInput), { timeout: 8000, timeoutMsg: 'The search box did not open' });
    const input = await this.firstDisplayed(locators.searchInput);
    await input.setValue(keyword);
    await browser.keys('Enter');
    await browser.pause(2500);
  }

  async openPolicy(policy) {
    await this.open('/');
    const footer = await this.footer();
    const trigger = await footer.$(locators.policyTrigger);
    if (await trigger.isExisting()) {
      await this.tap(trigger, 'Terms and Policies');
      await browser.pause(700);
    }
    await this.tapLinkNamed(policy.name, footer);
  }

  async heroInfo() {
    return browser.execute((buttonCss) => {
      const num = (r) => ({ left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) });
      const h1 = Array.from(document.querySelectorAll('h1')).find((h) => h.getBoundingClientRect().width > 10) || document.querySelector('h1');
      const cta = document.querySelector(buttonCss);
      const images = Array.from(document.querySelectorAll('main img'))
        .map((i) => ({ r: i.getBoundingClientRect(), ok: i.complete && i.naturalWidth > 0, src: (i.currentSrc || i.src || '').split('?')[0].slice(-60) }))
        .filter((x) => x.r.width > 150 && x.r.top < window.innerHeight)
        .map((x) => ({ ...num(x.r), ok: x.ok, src: x.src }));
      return {
        screenW: window.innerWidth,
        headline: h1 ? h1.innerText.trim() : '',
        headlineBox: h1 ? num(h1.getBoundingClientRect()) : null,
        headlineClipped: h1 ? h1.scrollWidth > h1.clientWidth + 1 : false,
        cta: cta ? { text: cta.innerText.trim(), ...num(cta.getBoundingClientRect()) } : null,
        images,
      };
    }, locators.heroButton);
  }

  // Every category card on the home page: name, link path and size. Used to check stacking and overlap.
  async categoryCardReport() {
    return browser.execute((css) => {
      return Array.from(document.querySelectorAll(css))
        .map((a) => {
          const r = a.getBoundingClientRect();
          return { name: (a.innerText || '').replace('→', '').trim(), path: new URL(a.href).pathname, left: r.left, right: r.right, top: r.top + window.scrollY, bottom: r.bottom + window.scrollY, width: r.width, height: r.height, screenW: window.innerWidth };
        })
        .filter((x) => x.width > 0 && x.height > 0);
    }, locators.categoryCards);
  }

  async expectCardsDoNotOverlap(cards) {
    for (let i = 0; i < cards.length; i++) {
      for (let j = i + 1; j < cards.length; j++) {
        const a = cards[i];
        const b = cards[j];
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        must(!(w > 2 && h > 2), 'The cards "' + a.name + '" and "' + b.name + '" overlap by ' + Math.round(w) + 'x' + Math.round(h));
      }
    }
  }

  async footer() {
    const footer = await $('footer');
    await footer.scrollIntoView();
    return footer;
  }

  async helpfulLinksHeadingDisplayed() {
    const footer = await this.footer();
    const heading = await footer.$('.//*[normalize-space(text())="Helpful links"]');
    return (await heading.isExisting()) && (await heading.isDisplayed());
  }

  // Taps a link under the footer's "Helpful links" (opens the section first if it is collapsed).
  async tapFooterLink(name) {
    const footer = await this.footer();
    let shown = false;
    for (const link of await footer.$$('.//a[normalize-space(.)="' + name + '"]')) {
      if (await link.isDisplayed()) shown = true;
    }
    if (shown === false) {
      const heading = await footer.$('.//*[normalize-space(text())="Helpful links"]');
      if (await heading.isExisting()) {
        await heading.click();
        await browser.pause(600);
      }
    }
    await this.tapLinkNamed(name, footer);
  }
}

export default new StorePage();
