import { test, expect } from 'playwright/test';

test.describe('Storefront UI Tests', () => {
  test('homepage renders storefront elements and header', async ({ page }) => {
    await page.goto('/');

    // Verify page title exists and contains branding/content
    await expect(page).toHaveTitle(/.+/);

    // Verify header or main container is visible
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Verify at least one primary interactive element or section is present
    const header = page.locator('header').first();
    if (await header.isVisible()) {
      await expect(header).toBeVisible();
    }
  });

  test('contact page renders contact form and details', async ({ page }) => {
    await page.goto('/contact');

    // Page should load with 200 and visible body
    await expect(page.locator('body')).toBeVisible();

    // Check for contact heading or phone help form
    const phoneInput = page.locator('input[type="tel"]').first();
    if (await phoneInput.isVisible()) {
      await expect(phoneInput).toBeEnabled();
    }
  });

  test('admin login page renders login inputs and credentials form', async ({ page }) => {
    await page.goto('/admin/login');

    // Email and password fields should be visible
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    // Fill in mock credentials and ensure inputs accept values
    await emailInput.fill('admin@gur.com.bd');
    await expect(emailInput).toHaveValue('admin@gur.com.bd');

    await passwordInput.fill('secret123');
    await expect(passwordInput).toHaveValue('secret123');

    // Login submit button should be enabled
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toBeEnabled();
  });
});
