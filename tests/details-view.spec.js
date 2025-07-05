const { test, expect } = require('@playwright/test');
const ElectronApp = require('./helpers/electron-app');

test.describe('Details View', () => {
  let electronApp;

  test.beforeEach(async () => {
    electronApp = new ElectronApp();
  });

  test.afterEach(async () => {
    await electronApp.close();
  });

  test('should not show details by default', async () => {
    const window = await electronApp.launch();
    await electronApp.waitForFileTree();
    
    // Details should not be visible by default
    await expect(window.locator('.file-details')).not.toBeVisible();
    
    // Details indicator should not be visible
    await expect(window.locator('.details-indicator')).not.toBeVisible();
  });

  test('should toggle details view with Ctrl+D', async () => {
    const window = await electronApp.launch();
    await electronApp.waitForFileTree();
    
    // Press Ctrl+D to show details
    await window.keyboard.press('Control+d');
    
    // Wait a moment for the refresh
    await window.waitForTimeout(500);
    
    // Details should now be visible
    await expect(window.locator('.file-details').first()).toBeVisible();
    
    // Details indicator should be visible
    await expect(window.locator('.details-indicator')).toBeVisible();
    await expect(window.locator('.details-indicator')).toHaveText('Details');
    
    // Press Ctrl+D again to hide them
    await window.keyboard.press('Control+d');
    await window.waitForTimeout(500);
    
    // Details should be hidden again
    await expect(window.locator('.file-details')).not.toBeVisible();
    
    // Details indicator should be hidden
    await expect(window.locator('.details-indicator')).not.toBeVisible();
  });

  test('should show file size and last modified when details are enabled', async () => {
    const window = await electronApp.launch();
    await electronApp.waitForFileTree();
    
    // Enable details view
    await window.keyboard.press('Control+d');
    await window.waitForTimeout(500);
    
    // Check that file details contain size and modified information
    const fileItem = window.locator('.tree-item:has-text("README.md")').first();
    await expect(fileItem).toBeVisible();
    
    const fileDetails = fileItem.locator('.file-details');
    await expect(fileDetails).toBeVisible();
    
    // Should contain file size
    const fileSize = fileDetails.locator('.file-size');
    await expect(fileSize).toBeVisible();
    
    // Should contain modified date
    const fileModified = fileDetails.locator('.file-modified');
    await expect(fileModified).toBeVisible();
    
    // Should contain separator
    const separator = fileDetails.locator('.detail-separator');
    await expect(separator).toBeVisible();
    await expect(separator).toHaveText('•');
  });

  test('should show different info for directories vs files', async () => {
    const window = await electronApp.launch();
    await electronApp.waitForFileTree();
    
    // Enable details view
    await window.keyboard.press('Control+d');
    await window.waitForTimeout(500);
    
    // Check directory shows "--" for size
    const folderItem = window.locator('.tree-item:has-text("src")').first();
    const folderSize = folderItem.locator('.file-size');
    await expect(folderSize).toHaveText('--');
    
    // Check file shows actual size
    const fileItem = window.locator('.tree-item:has-text("package.json")').first();
    const fileSize = fileItem.locator('.file-size');
    const sizeText = await fileSize.textContent();
    expect(sizeText).toMatch(/\d+(\.\d+)?\s+(B|KB|MB|GB)/);
  });

  test('should format file sizes correctly', async () => {
    const window = await electronApp.launch();
    await electronApp.waitForFileTree();
    
    // Enable details view
    await window.keyboard.press('Control+d');
    await window.waitForTimeout(500);
    
    // Get file sizes from various files
    const fileSizes = await window.locator('.file-size:not(:has-text("--"))').allTextContents();
    
    // All file sizes should match the expected format
    fileSizes.forEach(size => {
      expect(size).toMatch(/^\d+(\.\d+)?\s+(B|KB|MB|GB|TB)$/);
    });
  });

  test('should format last modified dates correctly', async () => {
    const window = await electronApp.launch();
    await electronApp.waitForFileTree();
    
    // Enable details view
    await window.keyboard.press('Control+d');
    await window.waitForTimeout(500);
    
    // Get modified dates from files
    const modifiedDates = await window.locator('.file-modified:not(:has-text("--"))').allTextContents();
    
    // All dates should match expected relative format patterns
    modifiedDates.forEach(date => {
      expect(date).toMatch(/^(just now|\d+m ago|\d+h ago|yesterday|\d+d ago|\d+w ago|\d+mo ago|\d{1,2}\/\d{1,2}\/\d{4})$/);
    });
  });

  test('should handle keyboard navigation with details view enabled', async () => {
    const window = await electronApp.launch();
    await electronApp.waitForFileTree();
    
    // Enable details view
    await window.keyboard.press('Control+d');
    await window.waitForTimeout(500);
    
    // Focus the file tree
    await window.locator('.file-tree').focus();
    
    // Navigate with arrow keys - should work with details visible
    await window.keyboard.press('ArrowDown');
    await window.keyboard.press('ArrowDown');
    
    // Should have keyboard focus on some item
    await expect(window.locator('.tree-item.keyboard-focused')).toBeVisible();
  });
});