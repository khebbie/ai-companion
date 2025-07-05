const { test, expect } = require('@playwright/test');
const ElectronApp = require('./helpers/electron-app');

test.describe('File Tree Display and Navigation', () => {
  let electronApp;

  test.beforeEach(async () => {
    electronApp = new ElectronApp();
  });

  test.afterEach(async () => {
    await electronApp.close();
  });

  test('should display file tree with correct structure', async () => {
    const window = await electronApp.launch();
    
    // Wait for file tree to load
    await electronApp.waitForFileTree();
    
    // Check that files and folders are displayed
    const fileItems = await electronApp.getFileTreeItems();
    expect(fileItems.length).toBeGreaterThan(0);
    
    // Verify specific test files exist
    await expect(window.locator('.file-item:has-text("README.md")')).toBeVisible();
    await expect(window.locator('.file-item:has-text("src")')).toBeVisible();
    await expect(window.locator('.file-item:has-text("tests")')).toBeVisible();
  });

  test('should expand and collapse folders', async () => {
    const window = await electronApp.launch();
    await electronApp.waitForFileTree();
    
    // Find a folder (src)
    const srcFolder = window.locator('.file-item:has-text("src")').first();
    await expect(srcFolder).toBeVisible();
    
    // Click to expand
    await srcFolder.click();
    
    // Wait a moment for expansion
    await window.waitForTimeout(500);
    
    // Check that folder contents are visible
    await expect(window.locator('.file-item:has-text("index.js")')).toBeVisible();
    
    // Click again to collapse
    await srcFolder.click();
    await window.waitForTimeout(500);
    
    // Contents should be hidden (or at least folder should be collapsed)
    const expandedItems = await window.locator('.file-item.expanded').count();
    expect(expandedItems).toBeLessThanOrEqual(1); // Only root might be expanded
  });

  test('should open files with double-click', async () => {
    const window = await electronApp.launch();
    await electronApp.waitForFileTree();
    
    // Double-click on a file
    const readmeFile = window.locator('.file-item:has-text("README.md")').first();
    await readmeFile.dblclick();
    
    // Note: We can't easily test the actual file opening since it uses system default
    // But we can verify the double-click event was processed without errors
    // This is a behavior test - we ensure the UI responds to double-click
    await window.waitForTimeout(100);
    
    // Verify the app is still responsive
    await expect(window.locator('.file-tree')).toBeVisible();
  });

  test('should handle permission errors gracefully', async () => {
    // Test with a restricted directory (without --dangerously-skip-permissions)
    const window = await electronApp.launch(['/root']); // This should fail gracefully
    
    // App should still launch and show some indication of the error
    await expect(window.locator('body')).toBeVisible();
    
    // The app should either show the current directory or an error message
    // but it shouldn't crash
    const hasContent = await window.locator('.file-tree, .error-message').count() > 0;
    expect(hasContent).toBeTruthy();
  });

  test('should auto-refresh when files change', async () => {
    const window = await electronApp.launch();
    await electronApp.waitForFileTree();
    
    // Create a new file in the test directory
    const fs = require('fs');
    const path = require('path');
    const newFilePath = path.join(electronApp.testDir, 'new-test-file.txt');
    fs.writeFileSync(newFilePath, 'test content');
    
    // Wait for auto-refresh (should happen within a few seconds)
    await expect(window.locator('.file-item:has-text("new-test-file.txt")')).toBeVisible({ timeout: 5000 });
    
    // Delete the file
    fs.unlinkSync(newFilePath);
    
    // File should disappear from the tree
    await expect(window.locator('.file-item:has-text("new-test-file.txt")')).not.toBeVisible({ timeout: 5000 });
  });

  test('should display files in correct order', async () => {
    const window = await electronApp.launch();
    await electronApp.waitForFileTree();
    
    const fileItems = await window.locator('.file-item .file-name').allTextContents();
    
    // Verify that directories come before files (common file explorer behavior)
    let foundFirstFile = false;
    let foundDirAfterFile = false;
    
    for (const item of fileItems) {
      // Skip if it's a directory indicator
      const isDirectory = await window.locator(`.file-item:has-text("${item}") .folder-icon`).count() > 0;
      
      if (!isDirectory && !foundFirstFile) {
        foundFirstFile = true;
      } else if (isDirectory && foundFirstFile) {
        foundDirAfterFile = true;
        break;
      }
    }
    
    // In a proper file explorer, directories should come first
    expect(foundDirAfterFile).toBeFalsy();
  });
});