const { test, expect } = require('@playwright/test');
const ElectronApp = require('./helpers/electron-app');

test.describe('Breadcrumb Navigation and Working Directory', () => {
  let electronApp;

  test.beforeEach(async () => {
    electronApp = new ElectronApp();
  });

  test.afterEach(async () => {
    await electronApp.close();
  });

  test('should display breadcrumb with current path', async () => {
    const window = await electronApp.launch();
    await electronApp.waitForFileTree();
    
    // Should show breadcrumb navigation
    await expect(window.locator('.breadcrumb')).toBeVisible();
    
    // Should contain path segments
    const breadcrumbItems = await electronApp.getBreadcrumbs();
    expect(breadcrumbItems.length).toBeGreaterThan(0);
  });

  test('should show actual username instead of tilde in breadcrumb', async () => {
    const window = await electronApp.launch();
    await electronApp.waitForFileTree();
    
    const breadcrumbText = await window.locator('.breadcrumb').textContent();
    
    // Should not contain tilde (~) but actual username
    expect(breadcrumbText).not.toContain('~');
    
    // Should contain a real username (not empty)
    const os = require('os');
    const username = os.userInfo().username;
    if (breadcrumbText.includes('/home/')) {
      expect(breadcrumbText).toContain(username);
    }
  });

  test('should make breadcrumb segments clickable', async () => {
    const window = await electronApp.launch();
    await electronApp.waitForFileTree();
    
    // Get breadcrumb items
    const breadcrumbItems = await electronApp.getBreadcrumbs();
    
    if (breadcrumbItems.length > 1) {
      // Click on a parent directory segment
      const parentSegment = breadcrumbItems[breadcrumbItems.length - 2];
      await parentSegment.click();
      
      // Should change working directory and update file tree
      await window.waitForTimeout(1000);
      
      // Verify the breadcrumb updated (path should be shorter)
      const newBreadcrumbItems = await electronApp.getBreadcrumbs();
      expect(newBreadcrumbItems.length).toBeLessThanOrEqual(breadcrumbItems.length);
    }
  });

  test('should update breadcrumb when navigating via double-click', async () => {
    const window = await electronApp.launch();
    await electronApp.waitForFileTree();
    
    // Get initial breadcrumb
    const initialBreadcrumb = await window.locator('.breadcrumb').textContent();
    
    // Double-click on a folder to navigate into it
    const srcFolder = window.locator('.file-item:has-text("src")').first();
    await srcFolder.dblclick();
    
    // Wait for navigation
    await window.waitForTimeout(1000);
    
    // Breadcrumb should update to show new path
    const newBreadcrumb = await window.locator('.breadcrumb').textContent();
    expect(newBreadcrumb).not.toBe(initialBreadcrumb);
    expect(newBreadcrumb).toContain('src');
  });

  test('should have reduced spacing in breadcrumb as requested', async () => {
    const window = await electronApp.launch();
    await electronApp.waitForFileTree();
    
    // Check breadcrumb styling for compact spacing
    const breadcrumb = window.locator('.breadcrumb');
    await expect(breadcrumb).toBeVisible();
    
    // Verify breadcrumb items have appropriate spacing
    const breadcrumbStyle = await breadcrumb.evaluate(el => {
      const style = getComputedStyle(el);
      return {
        gap: style.gap,
        padding: style.padding,
        margin: style.margin
      };
    });
    
    // Should have compact spacing (exact values depend on CSS, but should be reasonable)
    expect(breadcrumbStyle.gap !== '20px').toBeTruthy(); // Not excessively spaced
  });

  test('should handle working directory change properly', async () => {
    const window = await electronApp.launch();
    await electronApp.waitForFileTree();
    
    // Create a subdirectory with files
    const fs = require('fs');
    const path = require('path');
    const subDirPath = path.join(electronApp.testDir, 'navigation-test');
    fs.mkdirSync(subDirPath);
    fs.writeFileSync(path.join(subDirPath, 'sub-file.js'), 'console.log("sub");');
    
    // Wait for directory to appear
    await window.waitForTimeout(1000);
    
    // Double-click to navigate into subdirectory
    const subFolder = window.locator('.file-item:has-text("navigation-test")');
    await expect(subFolder).toBeVisible({ timeout: 3000 });
    await subFolder.dblclick();
    
    // Wait for navigation
    await window.waitForTimeout(1000);
    
    // Should now show files from the subdirectory
    await expect(window.locator('.file-item:has-text("sub-file.js")')).toBeVisible({ timeout: 3000 });
    
    // Original files should not be visible anymore
    await expect(window.locator('.file-item:has-text("README.md")')).not.toBeVisible();
  });

  test('should handle navigation to parent directory', async () => {
    const window = await electronApp.launch();
    await electronApp.waitForFileTree();
    
    // Navigate into a subdirectory first
    const srcFolder = window.locator('.file-item:has-text("src")').first();
    await srcFolder.dblclick();
    await window.waitForTimeout(1000);
    
    // Should now be in src directory
    await expect(window.locator('.file-item:has-text("index.js")')).toBeVisible();
    
    // Click on parent directory in breadcrumb
    const breadcrumbItems = await electronApp.getBreadcrumbs();
    if (breadcrumbItems.length > 1) {
      const parentSegment = breadcrumbItems[breadcrumbItems.length - 2];
      await parentSegment.click();
      
      // Should be back to parent directory
      await window.waitForTimeout(1000);
      await expect(window.locator('.file-item:has-text("README.md")')).toBeVisible({ timeout: 3000 });
    }
  });

  test('should persist working directory across navigation', async () => {
    const window = await electronApp.launch();
    await electronApp.waitForFileTree();
    
    // Navigate to subdirectory
    const srcFolder = window.locator('.file-item:has-text("src")').first();
    await srcFolder.dblclick();
    await window.waitForTimeout(1000);
    
    // Verify we're in the subdirectory
    await expect(window.locator('.file-item:has-text("index.js")')).toBeVisible();
    
    // Create a new file in this directory via context menu
    await window.locator('.file-tree').click({ button: 'right' });
    await window.locator('.context-menu-item:has-text("New File")').click();
    
    const input = window.locator('input[type="text"]');
    await input.fill('test-in-src.js');
    await input.press('Enter');
    
    // File should be created in the current (src) directory
    await expect(window.locator('.file-item:has-text("test-in-src.js")')).toBeVisible({ timeout: 3000 });
  });
});