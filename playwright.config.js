const { defineConfig, devices } = require('@playwright/test');

const AUTH = '.auth/storefront.json';

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: true,
  workers: 3,
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL || 'https://jasyeveryday.com',
    navigationTimeout: 30000,
    actionTimeout: 15000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // SLOW_MS=900 npm run watch  ->  slow motion so you can follow along
    launchOptions: { slowMo: Number(process.env.SLOW_MS || 0) },
  },
  projects: [
    // Opens the store once (enters the preview password if the store is locked), without a window.
    { name: 'setup', testMatch: /auth\.setup\.js/, use: { headless: true } },
    {
      // Tests tagged @mobile in their name do not run here.
      name: 'desktop',
      grepInvert: /@mobile/,
      use: { ...devices['Desktop Chrome'], channel: process.env.PW_CHANNEL || undefined, storageState: AUTH },
      dependencies: ['setup'],
    },
    {
      // Tests tagged @desktop in their name do not run here.
      name: 'mobile',
      grepInvert: /@desktop/,
      use: { ...devices['iPhone 13'], storageState: AUTH },
      dependencies: ['setup'],
    },
  ],
});
