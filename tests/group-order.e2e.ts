import { test, expect } from '@playwright/test';

test.describe('Group Order MVP E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to home page
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should create a group order and verify real-time sync between two users', async ({ browser }) => {
    // Create two browser contexts for two users
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // User 1 (Feras) creates a group order
      await page1.goto('/order/create');
      await page1.waitForLoadState('networkidle');
      
      await page1.selectOption('select', 'feras-uuid');
      await page1.check('input[value="SPLIT_WALLETS"]');
      await page1.click('button:has-text("Create Group Order")');
      
      // Wait for navigation to group order page
      await page1.waitForURL(/\/order\/[A-Z0-9]{12}/);
      const shareCode = page1.url().match(/\/order\/([A-Z0-9]{12})/)?.[1];
      expect(shareCode).toBeTruthy();
      
      console.log(`Group order created with code: ${shareCode}`);

      // User 2 (Ahmed) joins the group order
      await page2.goto(`/order/${shareCode}`);
      await page2.waitForLoadState('networkidle');
      
      await page2.selectOption('select', 'ahmed-uuid');
      
      // User 1 adds an item
      await page1.fill('input[placeholder="Item name"]', 'Chicken Burger');
      await page1.fill('input[placeholder="Price (e.g., 15.00)"]', '15.00');
      await page1.fill('input[min="1"]', '2');
      await page1.click('button:has-text("Add Item")');
      
      // Wait for real-time update on User 2's screen
      await expect(page2.locator('text=Chicken Burger')).toBeVisible({ timeout: 5000 });
      await expect(page2.locator('text=$30.00')).toBeVisible({ timeout: 5000 });
      
      // User 2 adds an item
      await page2.fill('input[placeholder="Item name"]', 'Caesar Salad');
      await page2.fill('input[placeholder="Price (e.g., 15.00)"]', '12.00');
      await page2.click('button:has-text("Add Item")');
      
      // Wait for real-time update on User 1's screen
      await expect(page1.locator('text=Caesar Salad')).toBeVisible({ timeout: 5000 });
      await expect(page1.locator('text=$42.00')).toBeVisible({ timeout: 5000 });
      
      // User 1 (host) locks cart for checkout
      await page1.click('button:has-text("Confirm & Pay")');
      
      // Verify checkout breakdown is shown on both screens
      await expect(page1.locator('text=Checkout Breakdown')).toBeVisible({ timeout: 5000 });
      await expect(page2.locator('text=Cart locked for checkout')).toBeVisible({ timeout: 5000 });
      
      console.log('✅ Real-time sync test passed');
      
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('should generate QR code for wallet transfer', async ({ page }) => {
    await page.goto('/wallet');
    await page.waitForLoadState('networkidle');
    
    // Select user
    await page.selectOption('select', 'feras-uuid');
    
    // Wait for balance to load
    await expect(page.locator('text=$500.00')).toBeVisible({ timeout: 5000 });
    
    // Generate QR code
    await page.fill('input[placeholder="15.00"]', '25.00');
    await page.click('button:has-text("Generate QR Code")');
    
    // Wait for QR code to appear
    await expect(page.locator('img[alt="QR Code"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Requests: $25.00')).toBeVisible({ timeout: 5000 });
    
    console.log('✅ QR code generation test passed');
  });

  test('should handle item removal and total recalculation', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // Create group order
      await page1.goto('/order/create');
      await page1.waitForLoadState('networkidle');
      await page1.selectOption('select', 'feras-uuid');
      await page1.click('button:has-text("Create Group Order")');
      await page1.waitForURL(/\/order\/[A-Z0-9]{12}/);
      const shareCode = page1.url().match(/\/order\/([A-Z0-9]{12})/)?.[1];
      
      // User 2 joins
      await page2.goto(`/order/${shareCode}`);
      await page2.waitForLoadState('networkidle');
      await page2.selectOption('select', 'ahmed-uuid');
      
      // Add items
      await page1.fill('input[placeholder="Item name"]', 'Item A');
      await page1.fill('input[placeholder="Price (e.g., 15.00)"]', '10.00');
      await page1.click('button:has-text("Add Item")');
      
      await page2.fill('input[placeholder="Item name"]', 'Item B');
      await page2.fill('input[placeholder="Price (e.g., 15.00)"]', '20.00');
      await page2.click('button:has-text("Add Item")');
      
      // Verify total is $30
      await expect(page1.locator('text=$30.00')).toBeVisible({ timeout: 5000 });
      
      // User 1 removes their item
      await page1.click('text=Remove');
      
      // Verify total updated to $20 on both screens
      await expect(page1.locator('text=$20.00')).toBeVisible({ timeout: 5000 });
      await expect(page2.locator('text=$20.00')).toBeVisible({ timeout: 5000 });
      
      console.log('✅ Item removal test passed');
      
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('should prevent modifications after cart is locked', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // Create group order
      await page1.goto('/order/create');
      await page1.waitForLoadState('networkidle');
      await page1.selectOption('select', 'feras-uuid');
      await page1.click('button:has-text("Create Group Order")');
      await page1.waitForURL(/\/order\/[A-Z0-9]{12}/);
      const shareCode = page1.url().match(/\/order\/([A-Z0-9]{12})/)?.[1];
      
      // User 2 joins
      await page2.goto(`/order/${shareCode}`);
      await page2.waitForLoadState('networkidle');
      await page2.selectOption('select', 'ahmed-uuid');
      
      // Add item
      await page1.fill('input[placeholder="Item name"]', 'Test Item');
      await page1.fill('input[placeholder="Price (e.g., 15.00)"]', '15.00');
      await page1.click('button:has-text("Add Item")');
      
      // Lock cart
      await page1.click('button:has-text("Confirm & Pay")');
      await expect(page1.locator('text=Checkout Breakdown')).toBeVisible({ timeout: 5000 });
      
      // Try to add item after lock - should be disabled
      const addItemButton = page2.locator('button:has-text("Add Item")');
      await expect(addItemButton).toBeDisabled({ timeout: 5000 });
      
      console.log('✅ Cart lock prevention test passed');
      
    } finally {
      await context1.close();
      await context2.close();
    }
  });
});

test.describe('Wallet Transfer Tests', () => {
  test('should show wallet balance and transaction history', async ({ page }) => {
    await page.goto('/wallet');
    await page.waitForLoadState('networkidle');
    
    // Select user
    await page.selectOption('select', 'feras-uuid');
    
    // Verify balance
    await expect(page.locator('text=$500.00')).toBeVisible({ timeout: 5000 });
    
    // Verify transaction history section
    await expect(page.locator('text=Recent Transactions')).toBeVisible();
    
    console.log('✅ Wallet balance test passed');
  });
});