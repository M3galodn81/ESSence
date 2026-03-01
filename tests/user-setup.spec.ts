import { test, expect, Page } from '@playwright/test';

// --- TEST DATA ---
// A diverse mix of users to test different RBAC roles, genders, and civil statuses
const testUsers = [
  {
    firstName: 'Patricia',
    lastName: 'Diaz',
    birthDate: '1990-08-22',
    gender: 'Female',
    civilStatus: 'Married', // Eligible for Maternity
    uiRoleName: 'Payroll Officer',
    hireDate: '2023-03-01',
    department: 'Finance',
    position: 'Payroll Specialist',
    email: 'patricia.diaz@essence.com'
  },
  {
    firstName: 'Robert',
    lastName: 'Chen',
    birthDate: '1985-11-10',
    gender: 'Male',
    civilStatus: 'Married', // Eligible for Paternity
    uiRoleName: 'Manager',
    hireDate: '2023-02-01',
    department: 'Operations',
    position: 'General Manager',
    email: 'robert.chen@essence.com'
  },
  {
    firstName: 'Marco',
    lastName: 'Dalisay',
    birthDate: '1995-05-15',
    gender: 'Male',
    civilStatus: 'Single',
    uiRoleName: 'Employee',
    hireDate: '2024-01-15',
    department: 'Operations',
    position: 'Server',
    email: 'marco.dalisay@essence.com'
  },
  {
    firstName: 'Elena',
    lastName: 'Torres',
    birthDate: '1992-04-05',
    gender: 'Female',
    civilStatus: 'Separated', // Eligible for Solo Parent
    uiRoleName: 'Employee',
    hireDate: '2024-02-10',
    department: 'Kitchen',
    position: 'Prep Cook',
    email: 'elena.torres@essence.com'
  }
];

// --- REUSABLE HELPER FUNCTION ---
async function createTeamMember(page: Page, user: typeof testUsers[0]) {
  console.log(`Creating ${user.uiRoleName}: ${user.firstName} ${user.lastName}...`);
  
  // Open the Dialog
  await page.getByRole('button', { name: /Create User/i }).first().click();
  
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Create New User' })).toBeVisible();

  // --- Personal Information ---
  await dialog.locator('input[name="firstName"]').fill(user.firstName);
  await dialog.locator('input[name="lastName"]').fill(user.lastName);
  await dialog.locator('input[name="birthDate"]').fill(user.birthDate);
  
  // Handle Radix Select (Gender)
  await dialog.locator('text=Gender *').locator('..').getByRole('combobox').click();
  await page.getByRole('option', { name: user.gender, exact: true }).click();

  // Handle Radix Select (Civil Status)
  await dialog.locator('text=Civil Status *').locator('..').getByRole('combobox').click();
  await page.getByRole('option', { name: user.civilStatus, exact: true }).click();

  // --- Employment & Account ---
  await dialog.locator('input[name="hireDate"]').fill(user.hireDate);
  await dialog.locator('input[name="department"]').fill(user.department);
  await dialog.locator('input[name="position"]').fill(user.position);

  // Change Role if not a standard employee
  if (user.uiRoleName !== 'Employee') {
      await dialog.locator('text=Role').locator('..').getByRole('combobox').click();
      await page.getByRole('option', { name: user.uiRoleName, exact: true }).click();
  }
  
  await dialog.locator('input[name="email"]').fill(user.email);
  await dialog.locator('input[name="password"]').fill('qweqwe');

  // --- Contact Information (Dummy Data for testing) ---
  await dialog.locator('input[name="phoneNumber"]').fill('09171234567');
  await dialog.locator('input[name="address.street"]').fill('123 Main St');
  await dialog.locator('input[name="address.city"]').fill('Metro Manila');
  await dialog.locator('input[name="address.province"]').fill('NCR');
  await dialog.locator('input[name="address.zipCode"]').fill('1000');

  // --- Emergency Contact (Dummy Data for testing) ---
  await dialog.locator('input[name="emergencyContact.name"]').fill('Juan Dela Cruz');
  await dialog.locator('input[name="emergencyContact.relation"]').fill('Relative');
  await dialog.locator('input[name="emergencyContact.phone"]').fill('09171234567');

  // Submit the Form inside the dialog
  await dialog.getByRole('button', { name: 'Create User', exact: true }).click();

  // Wait for success and dialog closure
  // FIX: Added .first() to handle overlapping toasts from previous loop iterations
  await expect(page.getByText('User created successfully').first()).toBeVisible();
  await expect(dialog).toBeHidden();

  // Verify they appear in the Team Table ("Last Name, First Name")
  await expect(page.getByText(`${user.firstName} ${user.lastName}`)).toBeVisible();
}


// --- MAIN TEST BLOCK ---
test.describe('System Setup & User Management Flow', () => {
  
  test('should complete admin setup, login, and create multiple employees', async ({ page }) => {
    
    // ================================================================
    // STEP 1: ADMIN SETUP WIZARD
    // ================================================================
    console.log('Navigating to Setup Wizard...');
    await page.goto('/setup'); 

    await page.getByLabel('First Name').fill('System');
    await page.getByLabel('Last Name').fill('Admin');
    await page.getByLabel('Email Address').fill('admin@essence.com');
    await page.getByLabel('Username').fill('admin');
    
    await page.getByLabel('Password', { exact: true }).fill('qweqwe');
    await page.getByLabel('Confirm Password').fill('qweqwe');

    await page.getByRole('button', { name: 'Complete Setup' }).click();

    await expect(page.getByText('System Setup Complete!')).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Proceed to Login' }).click();


    // ================================================================
    // STEP 2: LOGIN AS NEW ADMIN
    // ================================================================
    console.log('Logging in as Admin...');
    await page.getByLabel(/username/i).fill('admin');
    await page.getByLabel(/password/i).fill('qweqwe');
    await page.getByRole('button', { name: /sign in|login/i }).click();

    // Wait for Dashboard to ensure Auth Context is fully loaded
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 2 })).toBeVisible({ timeout: 10000 });


    // ================================================================
    // STEP 3: NAVIGATE TO TEAM MANAGEMENT
    // ================================================================
    console.log('Navigating to Team Management...');
    await page.getByRole('button', { name: 'User Management' }).click();
    await expect(page.getByRole('heading', { name: 'User Management', level: 2 })).toBeVisible();


    // ================================================================
    // STEP 4: CREATE DIVERSE USERS IN A LOOP
    // ================================================================
    for (const user of testUsers) {
        await createTeamMember(page, user);
    }
    
    console.log('All test users created successfully!');
  });
});