// Checkout, only up to the shipping step with made-up customer data. It never touches the card fields or the Pay button.
import BasePage from './BasePage.js';

export const customer = {
  email: 'jasy.test+sim@example.com',
  firstName: 'Test',
  lastName: 'Shopper',
  address1: '123 Test Street',
  city: 'Austin',
  state: 'Texas',
  zip: '78701',
};

class CheckoutPage extends BasePage {
  // The first displayed field matching any of these selectors.
  async field(selectors) {
    for (const css of selectors) {
      for (const el of await $$(css)) {
        if (await el.isDisplayed()) return el;
      }
    }
    return null;
  }

  async fill(selectors, value, name) {
    const el = await this.field(selectors);
    if (el === null) throw new Error('Checkout has no visible "' + name + '" field (tried ' + selectors.join(', ') + ')');
    await this.jsScroll(el);
    await el.setValue(value);
  }

  async goFromCart() {
    await browser.url('/cart');
    const lower = "translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz')";
    const button = await this.firstDisplayed('//button[@name="checkout"] | //*[self::button or self::a][contains(' + lower + ',"check out") or contains(' + lower + ',"checkout")]');
    await this.tap(button, 'Check out');
    await this.waitForUrlToContain('/checkouts/', 30000);
    await browser.pause(3000);
  }

  async fillCustomer() {
    await this.fill(['input[name="email"]', 'input#email', 'input[type="email"]'], customer.email, 'Email');
    await this.fill(['input[name="firstName"]', 'input[autocomplete="given-name"]'], customer.firstName, 'First name');
    await this.fill(['input[name="lastName"]', 'input[autocomplete="family-name"]'], customer.lastName, 'Last name');
    await this.fill(['input[name="address1"]', 'input[autocomplete="address-line1"]'], customer.address1, 'Address');
    await this.fill(['input[name="city"]', 'input[autocomplete="address-level2"]'], customer.city, 'City');
    const state = await this.field(['select[name="zone"]', 'select[autocomplete="address-level1"]']);
    if (state !== null) await state.selectByVisibleText(customer.state);
    await this.fill(['input[name="postalCode"]', 'input[autocomplete="postal-code"]'], customer.zip, 'ZIP code');
    await browser.pause(3000);
  }
}

export default new CheckoutPage();
