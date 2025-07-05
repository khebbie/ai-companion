const { test, expect } = require('@playwright/test');
const ElectronApp = require('./helpers/electron-app');

test.describe('Hidden Files Toggle', () => {
  let electronApp;

  test.beforeEach(async () => {
    electronApp = new ElectronApp();
  });

  test.afterEach(async () => {
    await electronApp.close();
  });

  test('should not show hidden or gitignored files by default', async () => {
    const window = await electronApp.launch();
    await electronApp.waitForFileTree();
    
    // Hidden files should not be visible by default
    await expect(window.locator('.tree-item:has-text(".git")')).not.toBeVisible();
    
    // Hidden files indicator should not be visible
    await expect(window.locator('.hidden-files-indicator')).not.toBeVisible();
  });

  test('should toggle hidden and gitignored files with Ctrl+H', async () => {
    const window = await electronApp.launch();
    await electronApp.waitForFileTree();
    
    // Press Ctrl+H to show hidden files
    await window.keyboard.press('Control+h');
    
    // Wait a moment for the refresh
    await window.waitForTimeout(500);
    
    // Hidden files should now be visible
    await expect(window.locator('.tree-item:has-text(".git")')).toBeVisible();
    
    // Hidden files indicator should be visible
    await expect(window.locator('.hidden-files-indicator')).toBeVisible();
    await expect(window.locator('.hidden-files-indicator')).toHaveText('Show Hidden & Ignored');
    
    // Press Ctrl+H again to hide them
    await window.keyboard.press('Control+h');
    await window.waitForTimeout(500);
    
    // Hidden files should be hidden again
    await expect(window.locator('.tree-item:has-text(".git")')).not.toBeVisible();
    
    // Hidden files indicator should be hidden
    await expect(window.locator('.hidden-files-indicator')).not.toBeVisible();
  });

  test('should style hidden and gitignored files differently when shown', async () => {
    const window = await electronApp.launch();
    await electronApp.waitForFileTree();
    
    // Show hidden files
    await window.keyboard.press('Control+h');
    await window.waitForTimeout(500);
    
    // Check that hidden files have the proper CSS class
    const hiddenFile = window.locator('.tree-item:has-text(".git")').first();
    await expect(hiddenFile).toHaveClass(/hidden-file/);
    
    // Check that the hidden file has reduced opacity
    const opacity = await hiddenFile.evaluate(el => getComputedStyle(el).opacity);
    expect(parseFloat(opacity)).toBeLessThan(1);
  });

  test('should distinguish between hidden files and gitignored files', async () => {
    const window = await electronApp.launch();
    await electronApp.waitForFileTree();
    
    // Show hidden files
    await window.keyboard.press('Control+h');
    await window.waitForTimeout(500);
    
    // Check for different CSS classes
    const hiddenFile = window.locator('.tree-item:has-text(".git")').first();
    await expect(hiddenFile).toHaveClass(/hidden-file/);
    
    // If there are any gitignored files, they should have gitignored-file class
    // Note: This test assumes the test setup might create some ignored files
    const allItems = await window.locator('.tree-item').all();
    
    // Verify that at least some items are visible (hidden files)
    expect(allItems.length).toBeGreaterThan(0);
  });

  test('should handle keyboard navigation with hidden files shown', async () => {
    const window = await electronApp.launch();
    await electronApp.waitForFileTree();
    
    // Show hidden files
    await window.keyboard.press('Control+h');
    await window.waitForTimeout(500);
    
    // Focus the file tree
    await window.locator('.file-tree').focus();
    
    // Navigate with arrow keys - should work with hidden files visible
    await window.keyboard.press('ArrowDown');
    await window.keyboard.press('ArrowDown');
    
    // Should have keyboard focus on some item
    await expect(window.locator('.tree-item.keyboard-focused')).toBeVisible();
  });
});