const { test, expect } = require('@playwright/test');
const ElectronApp = require('./helpers/electron-app');

test.describe('Context Menu Operations', () => {
  let electronApp;

  test.beforeEach(async () => {
    electronApp = new ElectronApp();
  });

  test.afterEach(async () => {
    await electronApp.close();
  });

  test('should show context menu on right-click', async () => {
    const window = await electronApp.launch();
    await electronApp.waitForFileTree();
    
    // Right-click on a file
    const fileItem = window.locator('.file-item:has-text("README.md")').first();
    await fileItem.click({ button: 'right' });
    
    // Context menu should appear
    await expect(window.locator('.context-menu')).toBeVisible();
    
    // Verify menu options are present
    await expect(window.locator('.context-menu-item:has-text("Rename")')).toBeVisible();
    await expect(window.locator('.context-menu-item:has-text("Delete")')).toBeVisible();
    await expect(window.locator('.context-menu-item:has-text("New File")')).toBeVisible();
    await expect(window.locator('.context-menu-item:has-text("New Folder")')).toBeVisible();
  });

  test('should hide context menu on click outside', async () => {
    const window = await electronApp.launch();
    await electronApp.waitForFileTree();
    
    // Show context menu
    const fileItem = window.locator('.file-item:has-text("README.md")').first();
    await fileItem.click({ button: 'right' });
    await expect(window.locator('.context-menu')).toBeVisible();
    
    // Click outside the menu
    await window.locator('body').click({ position: { x: 10, y: 10 } });
    
    // Menu should be hidden
    await expect(window.locator('.context-menu')).not.toBeVisible();
  });

  test('should hide context menu on Escape key', async () => {
    const window = await electronApp.launch();
    await electronApp.waitForFileTree();
    
    // Show context menu
    const fileItem = window.locator('.file-item:has-text("README.md")').first();
    await fileItem.click({ button: 'right' });
    await expect(window.locator('.context-menu')).toBeVisible();
    
    // Press Escape
    await window.keyboard.press('Escape');
    
    // Menu should be hidden
    await expect(window.locator('.context-menu')).not.toBeVisible();
  });

  test('should create new file', async () => {
    const window = await electronApp.launch();
    await electronApp.waitForFileTree();
    
    // Right-click in empty space or on a folder
    const fileTree = window.locator('.file-tree');
    await fileTree.click({ button: 'right', position: { x: 200, y: 200 } });
    
    // Click "New File"
    await window.locator('.context-menu-item:has-text("New File")').click();
    
    // Should show input for file name
    const input = window.locator('input[type="text"]');
    await expect(input).toBeVisible();
    
    // Type filename and press Enter
    await input.fill('test-new-file.js');
    await input.press('Enter');
    
    // File should appear in the tree
    await expect(window.locator('.file-item:has-text("test-new-file.js")')).toBeVisible({ timeout: 3000 });
  });

  test('should create new folder', async () => {
    const window = await electronApp.launch();
    await electronApp.waitForFileTree();
    
    // Right-click to show context menu
    const fileTree = window.locator('.file-tree');
    await fileTree.click({ button: 'right', position: { x: 200, y: 200 } });
    
    // Click "New Folder"
    await window.locator('.context-menu-item:has-text("New Folder")').click();
    
    // Should show input for folder name
    const input = window.locator('input[type="text"]');
    await expect(input).toBeVisible();
    
    // Type folder name and press Enter
    await input.fill('test-new-folder');
    await input.press('Enter');
    
    // Folder should appear in the tree
    await expect(window.locator('.file-item:has-text("test-new-folder")')).toBeVisible({ timeout: 3000 });
  });

  test('should rename file', async () => {
    const window = await electronApp.launch();
    await electronApp.waitForFileTree();
    
    // Right-click on a file
    const fileItem = window.locator('.file-item:has-text("README.md")').first();
    await fileItem.click({ button: 'right' });
    
    // Click "Rename"
    await window.locator('.context-menu-item:has-text("Rename")').click();
    
    // Should show input with current filename
    const input = window.locator('input[type="text"]');
    await expect(input).toBeVisible();
    
    // Clear and type new name
    await input.fill('RENAMED-README.md');
    await input.press('Enter');
    
    // File should have new name
    await expect(window.locator('.file-item:has-text("RENAMED-README.md")')).toBeVisible({ timeout: 3000 });
    await expect(window.locator('.file-item:has-text("README.md")')).not.toBeVisible();
  });

  test('should cancel rename on Escape', async () => {
    const window = await electronApp.launch();
    await electronApp.waitForFileTree();
    
    // Right-click on a file
    const fileItem = window.locator('.file-item:has-text("README.md")').first();
    await fileItem.click({ button: 'right' });
    
    // Click "Rename"
    await window.locator('.context-menu-item:has-text("Rename")').click();
    
    // Input should be visible
    const input = window.locator('input[type="text"]');
    await expect(input).toBeVisible();
    
    // Press Escape to cancel
    await input.press('Escape');
    
    // Input should be hidden and original name preserved
    await expect(input).not.toBeVisible();
    await expect(window.locator('.file-item:has-text("README.md")')).toBeVisible();
  });

  test('should delete file', async () => {
    const window = await electronApp.launch();
    await electronApp.waitForFileTree();
    
    // Create a temporary file first
    const fs = require('fs');
    const path = require('path');
    const tempFilePath = path.join(electronApp.testDir, 'temp-delete-me.txt');
    fs.writeFileSync(tempFilePath, 'delete me');
    
    // Wait for file to appear
    await expect(window.locator('.file-item:has-text("temp-delete-me.txt")')).toBeVisible({ timeout: 3000 });
    
    // Right-click on the file
    const fileItem = window.locator('.file-item:has-text("temp-delete-me.txt")').first();
    await fileItem.click({ button: 'right' });
    
    // Click "Delete"
    await window.locator('.context-menu-item:has-text("Delete")').click();
    
    // File should disappear from tree
    await expect(window.locator('.file-item:has-text("temp-delete-me.txt")')).not.toBeVisible({ timeout: 3000 });
  });

  test('should show "Reveal in File Manager" option', async () => {
    const window = await electronApp.launch();
    await electronApp.waitForFileTree();
    
    // Right-click on a file
    const fileItem = window.locator('.file-item:has-text("README.md")').first();
    await fileItem.click({ button: 'right' });
    
    // Context menu should have "Reveal in File Manager" option
    await expect(window.locator('.context-menu-item:has-text("Reveal in File Manager")')).toBeVisible();
  });
});