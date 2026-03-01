// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  /* Run tests sequentially to prevent SQLite database locks */
  fullyParallel: false,
  workers: 1, 
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:5000', // Change to 3000 or whatever port your app uses
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Automatically start your dev server before running tests */
  webServer: {
    command: 'npm run dev', // Ensure this is your command to start the app
    url: 'http://localhost:5000', // Matches baseURL
    reuseExistingServer: !process.env.CI,
  },
});