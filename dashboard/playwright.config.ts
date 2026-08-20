import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './tests/visual',
  timeout: 45_000,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'line',
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{projectName}/{arg}{ext}',
  expect: {
    timeout: 20_000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.01,
      scale: 'css',
    },
  },
  use: {
    baseURL,
    colorScheme: 'light',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    reducedMotion: 'reduce',
    deviceScaleFactor: 1,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: '1440', use: { viewport: { width: 1440, height: 900 } } },
    { name: '1024', use: { viewport: { width: 1024, height: 900 } } },
    { name: '768', use: { viewport: { width: 768, height: 900 } } },
    { name: '390', use: { viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      VITE_SUPABASE_URL: 'https://visual-regression.invalid',
      VITE_SUPABASE_ANON_KEY: 'visual-regression-public-placeholder',
    },
  },
});
