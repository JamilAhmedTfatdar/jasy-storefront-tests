# Test cases (TC-01 to TC-30)

Store: https://jasyeveryday.com. Every test runs on the public storefront only.
Desktop tests run in a desktop Chrome window size, phone tests in an iPhone 13 size.
A test name ending in @desktop or @mobile runs on that size only. No tag means both.

Status: **Auto** runs by itself. **Partly** has an automatic part and a manual part. **Manual** is a checklist for you.

| ID | Device | Area | Status | What the test does | Spec file |
|---|---|---|---|---|---|
| TC-01 | Both | Store loading | Auto | Home page opens, no password page, no broken images | 01 |
| TC-02 | Desktop | Header navigation | Auto | Home, Shop Essentials, About Us, Contact Us each open the right page | 01 |
| TC-03 | Phone | Hamburger menu | Auto | Opens, closes with X, closes when the background is tapped | 01 |
| TC-04 | Phone | Menu categories | Auto | Shop Essentials expands or opens; each of the 5 categories opens its page | 01 |
| TC-05 | Phone | Footer heading | Auto | Footer shows "Helpful links" | 01 |
| TC-06 | Phone | Helpful links: Shop Essentials | Auto | Tap it, the right collection opens | 01 |
| TC-07 | Phone | Helpful links: About Us | Auto | Tap it, the About Us page opens | 01 |
| TC-08 | Phone | Helpful links: Contact Us | Auto | Tap it, the Contact page opens | 01 |
| TC-09 | Phone | Helpful links: Search | Auto | Tap it, the Search page opens | 01 |
| TC-10 | Both | Search | Auto | Search for "pet", products appear | 02 |
| TC-11 | Both | Category pages | Auto | Each of 6 categories: title, products, images, prices; a separate test checks filters | 02 |
| TC-12 | Both | Product page | Auto | Mini Reusable Pet Hair Remover: title, price, description, images, quantity, Add to cart | 02 |
| TC-13 | Both | Product gallery | Auto | Desktop: zoom opens, picture fits, closes. Phone: no zoom button, main picture fits the screen | 02 |
| TC-14 | Phone | Gallery swipe | Partly | The gallery is scrolled sideways by one picture (what a swipe does) and the page must not move. A real finger swipe stays a quick manual check on your iPhone | 02 |
| TC-15 | Both | Add to cart | Auto | Click Add to cart; right product, right price, cart count | 03 |
| TC-16 | Both | Cart quantity | Auto | Increase, decrease, remove; subtotal follows | 03 |
| TC-17 | Both | Checkout | Auto | Checkout opens on https and shows the email field. Nothing is typed, nothing is paid | 03 |
| TC-18 | Both | Customer account | Partly | Account icon reaches the email sign-in form. Entering the emailed code is manual | 04 |
| TC-19 | Both | Account profile | Auto after one-time login | Needs `npm run login` once; otherwise skipped | 04 |
| TC-20 | Both | Account orders | Auto after one-time login | Same as TC-19 | 04 |
| TC-21 | Both | Contact page | Auto | Heading, support email, form or info, links work | 05 |
| TC-22 | Both | About page | Auto | Text, images, no sideways scroll | 05 |
| TC-23 | Both | Back navigation | Auto | Category, open a product, Back: layout is intact | 05 |
| TC-24 | Desktop run | Responsive layout | Auto | At 390, 768, 1024 and 1440 px: no sideways scroll, header controls do not overlap. Clipped text is a manual glance | 06 |
| TC-25 | Both | Footer | Auto | Helpful links, newsletter, 4 policy links, copyright | 05 |
| TC-26 | Both | Broken links | Auto | Every same-site link on key pages answers without an error | 06 |
| TC-27 | Both | Performance | Auto | Home and product pages show content within 5 seconds, no console errors | 06 |
| TC-28 | Both | Accessibility | Partly | Desktop keyboard focus is visible; no tiny text; phone tap targets are big enough. Colour contrast is manual | 06 |
| TC-29 | - | CJ safety | Manual | Check in CJ that Fulfill Authorized Orders is OFF. Not automated on purpose | - |
| TC-30 | - | Test-order safety | Manual | Run the Shopify Payments test checkout yourself, only after TC-29. Never click Fulfill | - |
| EX-01 | Both | Extra | Auto | No Gmail address on customer-facing pages (kept from the first version) | 06 |

## Safety rules the tests follow

- Public storefront only. No Shopify Admin, no CJ Admin, no stored passwords.
- Tests never type an email, address or card number, and never place an order.
- The storefront password is typed by you into the Terminal and is never saved in a file.

## Manual checklist for TC-29 and TC-30

1. CJ: auto-sync may stay ON. Fulfill Authorized Orders must be OFF.
2. Shopify: Payments in test mode, then place one test order with the Shopify test card.
3. Confirm the test order did not create a CJ charge, fulfillment or shipment.
4. Never click Fulfill on the test order.
