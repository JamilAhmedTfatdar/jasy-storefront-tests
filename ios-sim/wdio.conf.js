// WebdriverIO + Appium config: runs the storefront checks in real Safari on the iOS Simulator.
//
// Everything starts by itself when you run `npm test`:
//   - the Appium server (started by the appium service below)
//   - the iOS Simulator (Appium boots the device named below) with a visible phone window
//
// Change the device without editing this file:
//   DEVICE_NAME="iPhone 17" PLATFORM_VERSION="27.0" npm test
// List the devices you have with:  xcrun simctl list devices available
//
// The store password (only needed while the store is locked) is read from the environment,
// never from a file:   read -s "STOREFRONT_PASSWORD?Storefront password: "; export STOREFRONT_PASSWORD

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.BASE_URL || 'https://jasyeveryday.com';
const APPIUM_PORT = Number(process.env.APPIUM_PORT || 4723);
const SLOW_MS = Number(process.env.SLOW_MS ?? 1000);
// NATIVE_TAP=1 makes every tap a real finger tap on the screen instead of a browser click.
// Try it once the normal run works; it can miss if Safari's address bar sits at the bottom.
const NATIVE_TAP = process.env.NATIVE_TAP === '1';

export const config = {
  runner: 'local',
  specs: ['./test/specs/**/*.spec.js'],
  maxInstances: 1,

  // One real Safari on one iOS Simulator device.
  capabilities: [
    {
      platformName: 'iOS',
      browserName: 'Safari',
      'appium:automationName': 'XCUITest',
      'appium:deviceName': process.env.DEVICE_NAME || 'iPhone 17',
      'appium:platformVersion': process.env.PLATFORM_VERSION || '27.0',
      'appium:nativeWebTap': NATIVE_TAP,
      'appium:newCommandTimeout': 240,
      // The first run builds a helper app (WebDriverAgent) and can take a few minutes.
      'appium:wdaLaunchTimeout': 300000,
      'appium:wdaConnectionTimeout': 300000,
    },
  ],

  hostname: '127.0.0.1',
  port: APPIUM_PORT,
  path: '/',
  // Appium only prints errors, so nothing typed on the phone (like the store password) is logged.
  services: [
    [
      'appium',
      {
        command: path.join(here, 'node_modules', '.bin', 'appium'),
        args: { address: '127.0.0.1', port: APPIUM_PORT, logLevel: 'error' },
      },
    ],
  ],

  baseUrl: BASE_URL,
  logLevel: 'warn',
  waitforTimeout: 10000,
  connectionRetryTimeout: 300000,
  connectionRetryCount: 1,

  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: { ui: 'bdd', timeout: 300000 },

  // Slow motion so you can watch the phone. A short pause before every tap, typing, scroll and page load.
  // Change the speed:  SLOW_MS=2000 npm test   (turn off:  SLOW_MS=0 npm test)
  beforeCommand: async (commandName) => {
    if (SLOW_MS > 0 && ['click', 'setValue', 'url', 'scrollIntoView'].includes(commandName)) {
      await new Promise((resolve) => setTimeout(resolve, SLOW_MS));
    }
  },
};
