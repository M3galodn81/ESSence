import { test, expect } from '@playwright/test';

// Use an existing test user from your database seed script
const TEST_USER = {
  username: 'marco.dalisay',
  password: 'qweqwe', 
};

test.describe('Profile Management', () => {
  
  test.beforeEach(async ({ page }) => {
    // 1. Navigate to the app using the absolute URL
    await page.goto('/');
    
    // 2. Resilient Login Check using your exact data-testids from AuthPage.tsx
    try {
      const usernameInput = page.getByTestId('input-username');
      await usernameInput.waitFor({ state: 'visible', timeout: 3000 });
      
      // If visible, perform login
      await usernameInput.fill(TEST_USER.username);
      await page.getByTestId('input-password').fill(TEST_USER.password);
      await page.getByTestId('button-login').click();
      
      // Wait for navigation to dashboard to complete
      await page.waitForURL('**/');
    } catch (error) {
      console.log('Already logged in or skipped login.');
    }

    // 3. Navigate to the Profile Page using the data-testid from Sidebar.tsx
    await page.getByTestId('nav-profile').click();
    await page.waitForURL('**/profile');
  });

  test('should successfully update personal information including middle name', async ({ page }) => {
    // Locate the Edit Profile button and click it to enter edit mode
    const editButton = page.getByTestId('button-edit-profile');
    await expect(editButton).toBeVisible();
    await editButton.click();

    // Fill in Middle Name
    await page.locator('input[id="middleName"]').fill('Santos');

    // Fill in standard inputs using their IDs
    await page.locator('input[id="phoneNumber"]').fill('+63 917 123 4567');
    await page.locator('input[id="nationality"]').fill('Japanese');

    // Select Gender (First combobox in the form)
    const genderSelect = page.locator('button[role="combobox"]').nth(0);
    await genderSelect.click();
    await page.getByRole('option', { name: 'Male', exact: true }).click();

    // Select Civil Status (Second combobox in the form)
    const civilStatusSelect = page.locator('button[role="combobox"]').nth(1);
    await civilStatusSelect.click();
    await page.getByRole('option', { name: 'Married', exact: true }).click();

    // Save Changes
    await page.getByRole('button', { name: 'Save Changes' }).click();

    // Wait for the success toast to appear
    const successToast = page.getByText('Profile updated');
    await expect(successToast).toBeVisible();

    // FIXED: Use getByRole to specifically target the Header so it doesn't conflict with the text inside the card
    await expect(page.getByRole('heading', { name: 'Marco Santos Dalisay' })).toBeVisible();
    
    // Verify the rest of the UI returned to view mode and displays the new data
    await expect(page.getByText('+63 917 123 4567')).toBeVisible();
    await expect(page.getByText('Male', { exact: true })).toBeVisible();
    await expect(page.getByText('Married', { exact: true })).toBeVisible();
    await expect(page.getByText('Japanese', { exact: true })).toBeVisible();
  });

  test('should successfully update emergency contact', async ({ page }) => {
    // Navigate to Contact Details tab using the specific test ID
    await page.getByTestId('tab-contact').click();

    // Fill in emergency contact details
    await page.locator('input[id="emergencyName"]').fill('Maria Dalisay');
    await page.locator('input[id="relationship"]').fill('Mother');
    await page.locator('input[id="emergencyPhone"]').fill('0918-987-6543');

    // Submit Contact Form
    await page.getByRole('button', { name: 'Update Contact' }).click();

    // Verify toast
    const successToast = page.getByText('Emergency contact updated');
    await expect(successToast).toBeVisible();
  });

  test('should successfully update residential address', async ({ page }) => {
    // Navigate to Contact Details tab
    await page.getByTestId('tab-contact').click();

    // Fill in address details
    await page.locator('textarea[id="street"]').fill('456 Mabini St. Brgy. San Lorenzo');
    await page.locator('input[id="city"]').fill('Makati City');
    await page.locator('input[id="state"]').fill('Metro Manila');
    await page.locator('input[id="zipCode"]').fill('1223');
    await page.locator('input[id="country"]').fill('Philippines');

    // Submit Address Form
    await page.getByRole('button', { name: 'Update Address' }).click();

    // Verify toast
    const successToast = page.getByText('Address updated');
    await expect(successToast).toBeVisible();
  });

});