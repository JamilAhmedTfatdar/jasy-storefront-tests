# iOS Simulator checks (Appium + WebdriverIO, real Safari)

Six phone checks of https://jasyeveryday.com in real Safari on an iOS Simulator. You watch the
phone while the script taps, scrolls and swipes. The full list of checks (TC-01 to TC-30) runs in
Playwright from the project root; this folder covers the places where a real iPhone matters.

| ID | Plan | What it does |
|---|---|---|
| SIM-01 | TC-01 | The store opens in Safari |
| SIM-02 | TC-03 | The menu opens and closes with X |
| SIM-03 | TC-04 | Menu categories open their pages |
| SIM-04 | TC-05 to TC-09 | Footer Helpful links open the right pages |
| SIM-05 | TC-14 | A finger swipe moves the product gallery |
| SIM-06 | TC-15 | Add to cart works in Safari |

## Run it

From the project root, in Terminal:

```
cd ios-sim
npm install
npm run setup:driver      # one time: installs the iOS driver (says "already installed" if you have it)
npm run smoke             # first, the quick check: only SIM-01
npm test                  # then all six
```

The Simulator opens by itself. The first run builds a helper app (WebDriverAgent) and can take a few minutes.

If the store shows "Opening soon", type the preview password into the Terminal first (never into a file):

```
read -s "STOREFRONT_PASSWORD?Storefront password: "; export STOREFRONT_PASSWORD
```

## Speed

A short pause before every tap, keystroke, scroll and page load, so you can follow along.

```
SLOW_MS=2000 npm test    # slower
SLOW_MS=0 npm test       # full speed
```

## Pick a different device

```
xcrun simctl list devices available
DEVICE_NAME="iPhone 17" PLATFORM_VERSION="27.0" npm test
```

## Real finger taps

By default a tap is a browser click. `NATIVE_TAP=1 npm test` makes every tap a real tap on the
screen. It can miss when Safari's address bar is at the bottom, so try it after the normal run works.

## Where things are

- `wdio.conf.js`: device, Appium and speed
- `test/specs/storefront.spec.js`: WHAT is tested
- `test/pageobjects/`: HOW (menu, footer, gallery swipe, cart)
- `test/locators/`: WHERE things are on the page
- `test/data/site.js`: store names and links, read from `../tests/data/site.json`

## Rules

Public storefront only. No Shopify Admin, no CJ Admin, no real payment details, no orders.
Appium only logs errors, so the store password is never written to a log.
