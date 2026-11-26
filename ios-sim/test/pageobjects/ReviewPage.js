// The Judge.me review area on the product page. Reading and opening the form only. It never types or submits a review.
import BasePage from './BasePage.js';
import { locators } from '../locators/store.locators.js';

class ReviewPage extends BasePage {
  writeReviewXpath() {
    return '//button[contains(normalize-space(.),"Write a review")] | //a[contains(normalize-space(.),"Write a review")]';
  }

  // Scrolls down in steps (the widget loads when you get near it) until "Write a review" is on screen.
  async scrollToWidget() {
    for (let step = 0; step < 14; step++) {
      for (const el of await $$(this.writeReviewXpath())) {
        if (await el.isDisplayed()) {
          await this.jsScroll(el);
          return el;
        }
      }
      await this.scrollPage(700);
      await browser.pause(500);
    }
    throw new Error('The review widget ("Write a review") never appeared on the product page');
  }

  // The text of the area around the Write a review button (best effort; the exact wrapper is not known).
  async widgetText(button) {
    return browser.execute((b) => {
      const box = b.closest('[class*="jdgm"], [id*="judgeme"], [class*="judge"], .shopify-app-block, section') || b.parentElement;
      return (box.innerText || '').replace(/\s+/g, ' ').trim();
    }, button);
  }

  async liveReviewCount() {
    return (await $$(locators.liveReviews)).length;
  }

  async modalDisplayed() {
    for (const el of await $$(locators.reviewModal)) {
      if (await el.isDisplayed()) return true;
    }
    return false;
  }
}

export default new ReviewPage();
