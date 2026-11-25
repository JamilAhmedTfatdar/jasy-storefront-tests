# JASY Everyday storefront tests

Playwright checks for the public Shopify storefront at https://jasyeveryday.com on a desktop
browser size and an iPhone 13 size. The cases follow the plan TC-01 to TC-30 in `TEST-CASES.md`.

This is a separate project. It does not touch the `login-tests` framework.

## Set up (one time)

    cd ~/jasy-tests
    npm install
    npx playwright install chromium webkit

## Storefront password

While the store shows "Opening soon", the tests need the preview password. Type it into the
Terminal, never into a file:

    read -s "STOREFRONT_PASSWORD?Storefront password: "; export STOREFRONT_PASSWORD

Nothing shows while you type. Press Return. It lasts until you close that Terminal tab.

## Run

| What | Command |
|---|---|
| Everything, desktop and phone | `npm test` |
| Desktop only | `npm run test:desktop` |
| Phone only | `npm run test:mobile` |
| Watch the desktop run slowly | `PW_CHANNEL=chrome npm run watch` |
| Watch the phone run slowly | `npm run watch:mobile` |
| Watch the phone shopping flow only | `npm run watch:shop` |
| One test case | `npx playwright test -g "TC-15"` |
| Open the last HTML report | `npm run report` |

Save a run to a file: `FORCE_COLOR=0 npm test > discover/all-results.txt 2>&1`

## TC-19 and TC-20 (signed-in pages)

These need a signed-in session. Run this once, sign in yourself in the window that opens (email,
then the code Shopify emails you), then press Enter in the Terminal:

    npm run login

The session is saved in `.auth/customer.json`, which is not committed. Without it TC-19 and TC-20 are skipped.

## Where things are

- `tests/01` to `tests/06`: the test cases, in plan order
- `tests/helpers/storefront.js`: shared steps (phone menu, footer links, cart, product)
- `tests/data/site.json`: store names, links and the product used
- `legacy/`: the first version of the tests, kept for reference
- `playwright.config.js`: desktop and phone setup

## Rules

- Public storefront only. Never Shopify Admin or CJ Admin.
- Never real payment details. Never place an order. Never click Fulfill.
- Do not commit `.auth/`, `discover/`, `test-results/` or any password (`.gitignore` already covers them).

## iOS Simulator checks (real Safari)

The `ios-sim/` folder holds six phone checks that run in real Safari on an iOS Simulator, using
Appium and WebdriverIO. You can watch the phone while it taps, scrolls and swipes. See
`ios-sim/README.md` for how to run them.

    cd ios-sim
    npm install
    npm run setup:driver
    npm test

## What the tests found

Latest full Playwright run: 68 passed, 4 skipped, 2 failed. The two failures are real findings about the store:

- TC-27 (phone): Safari has no `requestIdleCallback`, and the phone run reports it. The Simulator run confirms it in real Safari: `typeof window.requestIdleCallback` is `undefined`.
- TC-28 (phone): the product gallery dots are 18 by 18 px, smaller than the 24 px touch target size that WCAG 2.2 recommends.

Also noted: two category pages (Kitchen & Home, Everyday Living) show "More products coming soon".

## Run it on GitHub

Open the Actions tab, choose "Storefront tests (manual)", click "Run workflow" and pick stable, all, desktop or mobile.
"stable" skips the cart, checkout and link checks, which the live store blocks or slows for GitHub's cloud servers
(they pass from a home computer), and the two known phone findings. "all" runs everything.
It starts only when you press the button. While the store is locked it needs a repository secret named
`STOREFRONT_PASSWORD` (Settings, Secrets and variables, Actions). The HTML report is saved on the run page
as an artifact for 14 days. The two known real findings (TC-27 and TC-28 on the phone) make a full run end red.
