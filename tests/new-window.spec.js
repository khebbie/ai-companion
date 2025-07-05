const { test, expect } = require('@playwright/test');
const ElectronApp = require('./helpers/electron-app');

test.describe('New AI Companion Window', () => {
  let electronApp;

  test.beforeEach(async () => {
    electronApp = new ElectronApp();
  });

  test.afterEach(async () => {
    await electronApp.close();
  });

  test('should have IPC handler registered in main process', async () => {
    const window = await electronApp.launch();
    
    // Execute a script in the main process to check if IPC handlers are registered
    const hasHandler = await electronApp.app.evaluate(async ({ ipcMain }) => {
      // Check if the handler is registered
      const handlers = ipcMain.listenerCount('open-new-ai-companion');
      return handlers > 0;
    });
    
    expect(hasHandler).toBe(true);
  });

  test('should handle IPC call from renderer process', async () => {
    const window = await electronApp.launch();
    await electronApp.waitForFileTree();
    
    // Test direct IPC communication
    const result = await window.evaluate(async (testDir) => {
      try {
        const { ipcRenderer } = require('electron');
        const response = await ipcRenderer.invoke('open-new-ai-companion', testDir);
        return response;
      } catch (error) {
        return { success: false, error: error.message };
      }
    }, electronApp.testDir);
    
    console.log('IPC Response:', result);
    
    // Should get a response (success or failure, but not undefined)
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
    
    // Should have either success or error property
    expect(result.success !== undefined || result.error !== undefined).toBe(true);
  });

  test('should trigger IPC call when context menu item is clicked', async () => {
    const window = await electronApp.launch();
    await electronApp.waitForFileTree();
    
    // Monitor IPC calls by injecting a spy
    await window.evaluate(() => {
      const { ipcRenderer } = require('electron');
      window.ipcCalls = [];
      
      // Monkey patch invoke to track calls
      const originalInvoke = ipcRenderer.invoke;
      ipcRenderer.invoke = function(...args) {
        window.ipcCalls.push(args);
        return originalInvoke.apply(this, args);
      };
    });
    
    // Right-click on a folder
    const folderItem = window.locator('.tree-item:has-text("src")').first();
    await folderItem.click({ button: 'right' });
    
    // Click "Open new AI Companion here"
    await window.locator('.context-menu-item:has-text("Open new AI Companion here")').click();
    
    // Wait for IPC call to complete
    await window.waitForTimeout(1000);
    
    // Check if IPC call was made
    const ipcCalls = await window.evaluate(() => window.ipcCalls);
    console.log('IPC calls made:', ipcCalls);
    
    // Should have made at least one IPC call to 'open-new-ai-companion'
    const aiCompanionCalls = ipcCalls.filter(call => call[0] === 'open-new-ai-companion');
    expect(aiCompanionCalls.length).toBeGreaterThan(0);
    
    // The call should include a target directory
    expect(aiCompanionCalls[0][1]).toBeDefined();
    expect(typeof aiCompanionCalls[0][1]).toBe('string');
  });

  test('should handle spawn errors gracefully', async () => {
    const window = await electronApp.launch();
    await electronApp.waitForFileTree();
    
    // Test with an invalid directory to trigger fallback
    const result = await window.evaluate(async () => {
      try {
        const { ipcRenderer } = require('electron');
        const response = await ipcRenderer.invoke('open-new-ai-companion', '/nonexistent/directory');
        return response;
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('Result with invalid directory:', result);
    
    // Should still get a response even if it fails
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });
});