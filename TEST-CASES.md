# Test cases (TC01 to TC52)

Source of truth: the JASY Everyday Shopify test plan (functional, responsive, checkout, CJ safety, reviews and live chat).
Store: https://jasyeveryday.com. Primary product: `/products/mini-reusable-pet-hair-remover`.

**Viewports in the plan:** desktop 1440 x 900 (smoke 1280 x 800); phone 390 x 844 and 430 x 932.

**Run order:** the iOS Simulator (real Safari, `ios-sim/`) comes first. When it goes well, the same scenarios run on the
desktop and phone sizes with Playwright. The Simulator uses its own phone's real screen size, so the two exact phone
widths (TC04, TC16, TC23) are checked with Playwright's phone sizes.

**Status:**
- **Auto**: runs by itself and never changes anything in the store.
- **Guarded**: automatic, but only when you switch it on (it types synthetic data or sends a message). Off by default.
- **Manual**: Shopify Admin, CJ, or real payment steps. Never automated. See the checklist at the end.

| ID | Area | Device | Status | What it checks |
|---|---|---|---|---|
| TC01 | Store availability | Desktop | Auto | Store opens over HTTPS with no password page, server error or blank screen |
| TC02 | Store availability | Phone | Auto | Phone storefront loads with no redirect loop or broken layout |
| TC03 | Desktop breakpoints | Desktop | Auto | 1440 x 900 and 1280 x 800: readable, no sideways scroll |
| TC04 | Phone breakpoints | Phone | Auto | 390 x 844 and 430 x 932: no clipped text, overlap or sideways scroll |
| TC05 | Header logo link | Both | Auto | Logo returns to the home page |
| TC06 | Header primary links | Desktop | Auto | Home, Shop Essentials, About Us, Contact Us open the right pages |
| TC07 | Header search | Both | Auto | Search opens, takes a keyword, shows results or a clear empty state |
| TC08 | Header account link | Both | Auto | Account icon opens the account page or sign-in without an error |
| TC09 | Header cart link | Both | Auto | Cart opens from an empty session and shows the empty-cart state |
| TC10 | Phone hamburger | Phone | Auto | Drawer opens and closes cleanly; links readable, nothing clipped |
| TC11 | Phone hamburger navigation | Phone | Auto | Home, Shop Essentials, About Us, Contact Us in the drawer route correctly |
| TC12 | Footer Helpful links | Desktop | Auto | Shop Essentials, About Us, Contact Us, Search are visible and route correctly |
| TC13 | Footer Helpful links | Phone | Auto | Same four links are reachable and route correctly |
| TC14 | Footer policy links | Both | Auto | Privacy, terms, shipping, return/refund pages load with content |
| TC15 | Home hero | Desktop | Auto | Logo, headline, copy, hero image and Shop Essentials button work |
| TC16 | Home hero | Phone | Auto | Hero wraps, image is not cropped badly, button is tappable (both widths) |
| TC17 | Home category cards | Desktop | Auto | Every visible card has the right title and destination |
| TC18 | Home category cards | Phone | Auto | Cards stack, do not overlap and are tappable |
| TC19 | Collection page | Desktop | Auto | Shop Essentials shows title, product cards, prices, filters if present |
| TC20 | Collection page | Phone | Auto | Grid or list is readable and scrolls |
| TC21 | Collection product card | Both | Auto | Image, title, price and link lead to the right product |
| TC22 | Product page content | Desktop | Auto | Title, Red variant, $19.99, description, quantity, Add to cart |
| TC23 | Product page content | Phone | Auto | Core information visible with no clipping (both widths) |
| TC24 | Product gallery | Desktop | Auto | Each image can be selected, back to the first; no broken image |
| TC25 | Product gallery | Phone | Auto | Swipe and tap work; no stuck scroll or unexpected zoom |
| TC26 | Variant selection | Both | Auto | Red variant selected state is clear; price and availability consistent |
| TC27 | Quantity controls | Both | Auto | Increase, decrease and an invalid quantity are handled; totals update |
| TC28 | Product Add to cart | Both | Auto | Adds the right product and variant once; cart count updates |
| TC29 | Review widget (Judge.me) | Desktop | Auto | Customer Reviews widget appears below the product details |
| TC30 | Review widget | Phone | Auto | Readable, responsive, does not cover other controls |
| TC31 | Empty-review behavior | Both | Auto | Empty state shows; no sample or preview review is presented as live |
| TC32 | Write-a-review control | Both | Auto | Form opens. Nothing is typed or submitted |
| TC33 | Review request schedule | Admin | Manual | Judge.me: After fulfilled, 14 days; reminders match policy |
| TC34 | Marketing opt-out protection | Admin | Manual | Judge.me Advanced: opt-out box is off; opted-out customers excluded |
| TC35 | Cart line item | Both | Auto | Right title, variant, quantity, price and image |
| TC36 | Cart quantity update | Both | Auto | 1 to 2 and back to 1; totals recalculate |
| TC37 | Cart removal | Both | Auto | Item disappears; intentional empty-cart state |
| TC38 | Checkout customer fields | Both | Guarded | Synthetic email, name and US address; errors are understandable. Stops before payment |
| TC39 | Checkout shipping method | Both | Guarded | Expected method with a correct, intentional price. Stops before payment |
| TC40 | Checkout payment validation | Both | Manual | Shopify test card only, in test mode. Never automated |
| TC41 | Checkout order summary | Both | Guarded | Product, quantity, shipping and total match the cart; no surprise fee or $0 shipping |
| TC42 | Shopify test order safety | Admin | Manual | One test-mode order: Test, Paid, Unfulfilled. Never click Fulfill |
| TC43 | Shopify order details | Admin | Manual | Product, customer and payment status match; stays unfulfilled |
| TC44 | CJ authorization | Admin/CJ | Manual | Store shows Authorized or Activated for the right Shopify store |
| TC45 | CJ fulfillment safety | Admin/CJ | Manual | Fulfill Authorized Orders stays OFF |
| TC46 | CJ inventory sync | Admin/CJ | Manual | Linked SKU correct; no sync error |
| TC47 | Cancellation and refund cleanup | Admin | Manual | Cancel and refund the test order with restock |
| TC48 | CJ cleanup verification | Admin/CJ | Manual | CJ does not pick, pay, fulfill or ship the canceled order |
| TC49 | Live chat visibility | Both | Auto | Chat bubble is visible, placed well, does not cover key content |
| TC50 | Live chat open and close | Both | Auto | Panel opens and closes cleanly; navigation and scroll still work |
| TC51 | Live chat interaction | Both | Guarded | Suggested questions respond; message box takes focus. A harmless message is sent only when switched on |
| TC52 | Live chat privacy and layout | Both | Auto | Privacy notice readable; panel fits both phone widths. Nothing sensitive typed |

## Safety rules the tests follow

- Public storefront only. Shopify Admin and CJ Admin are never automated.
- No real payment, shipment, fulfillment, customer message or review submission. Never click Fulfill.
- Synthetic data only, and only for the Guarded cases. Payment details are never typed by a test.
- The storefront password is typed by you into the Terminal and is never saved in a file.
- Every failure records the page address, screen size, a screenshot and the product involved.

## Switches for the Guarded cases

All are off unless you set them in the Terminal for that run.

    CHECKOUT_TEST=1     TC38, TC39, TC41  (types synthetic details into the checkout; never pays)
    CHAT_SEND=1         TC51              (sends one harmless test message in the chat)

## Manual checklist (Admin, CJ and payment)

1. TC33, TC34: Judge.me request settings and Advanced settings.
2. TC40, TC42, TC43: turn Shopify Payments test mode on, place one test order with the Shopify test card, check the order is Test, Paid and Unfulfilled. Turn test mode off again afterwards.
3. TC44 to TC46: CJ store is Authorized, Fulfill Authorized Orders is OFF, the linked SKU has no sync error.
4. TC47, TC48: cancel and refund the test order with restock, then confirm CJ did not pick, pay, fulfill or ship it.
5. Never click Fulfill on a test order.

## Review authenticity

Only genuine post-purchase customer reviews are collected and shown. Never import or publish fabricated reviews.
| TC41 | Checkout order summary | Both | Guarded | Product, quantity, shipping and total match the cart; no surprise fee or $0 shipping |
| TC42 | Shopify test order safety | Admin | Manual | One test-mode order: Test, Paid, Unfulfilled. Never click Fulfill |
| TC43 | Shopify order details | Admin | Manual | Product, customer and payment status match; stays unfulfilled |
| TC44 | CJ authorization | Admin/CJ | Manual | Store shows Authorized or Activated for the right Shopify store |
| TC45 | CJ fulfillment safety | Admin/CJ | Manual | Fulfill Authorized Orders stays OFF |
| TC46 | CJ inventory sync | Admin/CJ | Manual | Linked SKU correct; no sync error |
| TC47 | Cancellation and refund cleanup | Admin | Manual | Cancel and refund the test order with restock |
| TC48 | CJ cleanup verification | Admin/CJ | Manual | CJ does not pick, pay, fulfill or ship the canceled order |
| TC49 | Live chat visibility | Both | Auto | Chat bubble is visible, placed well, does not cover key content |
| TC50 | Live chat open and close | Both | Auto | Panel opens and closes cleanly; navigation and scroll still work |
| TC51 | Live chat interaction | Both | Guarded | Suggested questions respond; message box takes focus. A harmless message is sent only when switched on |
| TC52 | Live chat privacy and layout | Both | Auto | Privacy notice readable; panel fits both phone widths. Nothing sensitive typed |
| TC53 | Bath brush product page | Both | Auto | Title, gallery, color and style choices, $14.99 starting price, description, quantity, Add to cart; responsive |
| TC54 | Bath brush color and style variants | Both | Auto | Several colors, then a style (Beige + Round shape, Blue 3pcs + square): clear selection, picture and address update, Add to cart ready |
| TC55 | Bath brush sold-out combinations | Both | Auto | A sold-out combination cannot be bought; Add to cart becomes unavailable; the wrong variant is never added. Skipped when nothing is sold out |
| TC56 | Bath brush cart line | Both | Auto | Chosen color and style land in the cart once, with the right quantity, image and price |

## Safety rules the tests follow

- Public storefront only. Shopify Admin and CJ Admin are never automated.
- No real payment, shipment, fulfillment, customer message or review submission. Never click Fulfill.
- Synthetic data only, and only for the Guarded cases. Payment details are never typed by a test.
- The storefront password is typed by you into the Terminal and is never saved in a file.
- Every failure records the page address, screen size, a screenshot and the product involved.

## Switches for the Guarded cases

All are off unless you set them in the Terminal for that run.

    CHECKOUT_TEST=1     TC38, TC39, TC41  (types synthetic details into the checkout; never pays)
    CHAT_SEND=1         TC51              (sends one harmless test message in the chat)

## Manual checklist (Admin, CJ and payment)

1. TC33, TC34: Judge.me request settings and Advanced settings.
2. TC40, TC42, TC43: turn Shopify Payments test mode on, place one test order with the Shopify test card, check the order is Test, Paid and Unfulfilled. Turn test mode off again afterwards.
3. TC44 to TC46: CJ store is Authorized, Fulfill Authorized Orders is OFF, the linked SKU has no sync error.
4. TC47, TC48: cancel and refund the test order with restock, then confirm CJ did not pick, pay, fulfill or ship it.
5. Never click Fulfill on a test order.

## Review authenticity

Only genuine post-purchase customer reviews are collected and shown. Never import or publish fabricated reviews.

## Test and release plan

1. **Mobile first.** Run the iOS Simulator suite and save its output:
   `cd ios-sim; APPIUM_PORT=4733 npm test 2>&1 | tee ../release/mobile-run.txt`.
2. **Gate.** Desktop testing starts only when at least 80% of the mobile tests that ran passed (skipped tests are not counted) and no Major or Blocker bug is open in `release/bugs.json`. Otherwise fix the issues and rerun the affected tests (`npm test -- --mochaOpts.grep "TC10|TC11"`).
3. **Desktop.** From the project folder: `npm run release:desktop` (and `npm run release:phone` for the two phone sizes in Playwright).
4. **Report.** `npm run release:report` writes `release/RELEASE-REPORT.md`: pass rates, failed tests, open bugs by severity, a message for the team chat and a go-live recommendation.
5. **Decision.** Any open Major or Blocker bug means HOLD. Admin, CJ and payment checks (TC33, TC34, TC40, TC42 to TC48) are marked in `release/manual.json` by hand. The owner records the final decision in the report.

## Where each case runs

- **Simulator (`ios-sim/`, phone):** TC02, TC04, TC05, TC07 to TC11, TC13, TC14, TC16, TC18, TC20, TC21, TC23, TC25 to TC28, TC30 to TC32, TC35 to TC37, TC49 to TC56. Guarded: TC38, TC39, TC41.
- **Playwright (desktop and phone sizes):** all Auto and Guarded cases (files in `tests/`, plan IDs in the test names; `EX-nn` are extra checks that are not in the plan).
- **Manual:** TC33, TC34, TC40, TC42 to TC48.
