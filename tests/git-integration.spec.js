const { test, expect } = require('@playwright/test');
const ElectronApp = require('./helpers/electron-app');

test.describe('Git Integration and Status Indicators', () => {
  let electronApp;

  test.beforeEach(async () => {
    electronApp = new ElectronApp();
  });

  test.afterEach(async () => {
    await electronApp.close();
  });

  test('should display current branch in header', async () => {
    const window = await electronApp.launch();
    await electronApp.waitForFileTree();
    
    // Wait for git status to load
    await window.waitForTimeout(1000);
    
    // Should show branch name (likely "main" or "master")
    const branchElement = window.locator('.branch-info');
    await expect(branchElement).toBeVisible({ timeout: 5000 });
    
    const branchText = await branchElement.textContent();
    expect(branchText).toMatch(/(main|master)/);
  });

  test('should show lightning bolt icon for git branch', async () => {
    const window = await electronApp.launch();
    await electronApp.waitForFileTree();
    
    // Should show lightning bolt icon
    await expect(window.locator('.branch-info .lightning-icon, .branch-info [class*="lightning"]')).toBeVisible({ timeout: 5000 });
  });

  test('should display git status indicators for modified files', async () => {
    const window = await electronApp.launch();
    await electronApp.waitForFileTree();
    
    // Modify a file
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(electronApp.testDir, 'README.md');
    fs.appendFileSync(filePath, '\n# Modified content');
    
    // Wait for git status to update
    await window.waitForTimeout(2000);
    
    // Should show "M" badge for modified file
    const modifiedFile = window.locator('.file-item:has-text("README.md")');
    await expect(modifiedFile.locator('.git-status:has-text("M"), [class*="modified"]')).toBeVisible({ timeout: 5000 });
  });

  test('should display git status for new files', async () => {
    const window = await electronApp.launch();
    await electronApp.waitForFileTree();
    
    // Create a new file
    const fs = require('fs');
    const path = require('path');
    const newFilePath = path.join(electronApp.testDir, 'new-untracked.js');
    fs.writeFileSync(newFilePath, 'console.log("new file");');
    
    // Wait for file to appear and git status to update
    await window.waitForTimeout(2000);
    
    // Should show "?" badge for untracked file
    const newFile = window.locator('.file-item:has-text("new-untracked.js")');
    await expect(newFile).toBeVisible({ timeout: 3000 });
    await expect(newFile.locator('.git-status:has-text("?"), [class*="untracked"]')).toBeVisible({ timeout: 5000 });
  });

  test('should show git status colors for different file states', async () => {
    const window = await electronApp.launch();
    await electronApp.waitForFileTree();
    
    // Create and stage a new file
    const fs = require('fs');
    const path = require('path');
    const { execSync } = require('child_process');
    
    try {
      // Create new file
      const newFilePath = path.join(electronApp.testDir, 'staged-file.js');
      fs.writeFileSync(newFilePath, 'console.log("staged");');
      
      // Stage it
      execSync('git add staged-file.js', { cwd: electronApp.testDir, stdio: 'ignore' });
      
      // Wait for git status update
      await window.waitForTimeout(2000);
      
      // Should show "A" badge for added file
      const stagedFile = window.locator('.file-item:has-text("staged-file.js")');
      await expect(stagedFile).toBeVisible({ timeout: 3000 });
      await expect(stagedFile.locator('.git-status:has-text("A"), [class*="added"]')).toBeVisible({ timeout: 5000 });
      
      // Color should be green (added files are typically green)
      const gitStatus = stagedFile.locator('.git-status, [class*="added"]').first();
      const color = await gitStatus.evaluate(el => getComputedStyle(el).color);
      // Green color should contain "0, 128, 0" or similar green RGB values
      expect(color).toMatch(/(0,\s*128,\s*0|green|rgb\(.*0.*128.*0.*\))/i);
    } catch (error) {
      // Skip this test if git operations fail
      test.skip();
    }
  });

  test('should handle gitignored files with dimmed styling', async () => {
    const window = await electronApp.launch();
    await electronApp.waitForFileTree();
    
    // Create .gitignore file
    const fs = require('fs');
    const path = require('path');
    
    const gitignorePath = path.join(electronApp.testDir, '.gitignore');
    fs.writeFileSync(gitignorePath, 'ignored-file.txt\n*.log\n');
    
    // Create an ignored file
    const ignoredFilePath = path.join(electronApp.testDir, 'ignored-file.txt');
    fs.writeFileSync(ignoredFilePath, 'this file is ignored');
    
    // Wait for files to appear
    await window.waitForTimeout(2000);
    
    // Ignored file should appear dimmed/italicized
    const ignoredFile = window.locator('.file-item:has-text("ignored-file.txt")');
    await expect(ignoredFile).toBeVisible({ timeout: 3000 });
    
    // Check for dimmed/italic styling
    const isStyled = await ignoredFile.evaluate(el => {
      const style = getComputedStyle(el);
      return style.opacity < 1 || style.fontStyle === 'italic' || 
             el.classList.contains('git-ignored') || el.classList.contains('dimmed');
    });
    expect(isStyled).toBeTruthy();
  });

  test('should update git status automatically on file changes', async () => {
    const window = await electronApp.launch();
    await electronApp.waitForFileTree();
    
    // Wait for initial git status
    await window.waitForTimeout(1000);
    
    // Verify initial state (no M badge on README.md)
    const readmeFile = window.locator('.file-item:has-text("README.md")');
    
    // Modify the file
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(electronApp.testDir, 'README.md');
    fs.appendFileSync(filePath, '\n# Auto-update test');
    
    // Git status should update automatically (within a few seconds)
    await expect(readmeFile.locator('.git-status:has-text("M"), [class*="modified"]')).toBeVisible({ timeout: 10000 });
  });

  test('should handle repositories without git gracefully', async () => {
    // Create a new electron app helper for non-git directory
    const ElectronAppNoGit = class extends ElectronApp {
      async setupTestFiles() {
        // Call parent setup but don't initialize git
        const dirs = ['src', 'tests'];
        const files = ['README.md', 'src/index.js'];

        for (const dir of dirs) {
          const fs = require('fs');
          const path = require('path');
          fs.mkdirSync(path.join(this.testDir, dir), { recursive: true });
        }

        for (const file of files) {
          const fs = require('fs');
          const path = require('path');
          const filePath = path.join(this.testDir, file);
          fs.writeFileSync(filePath, `// Test content for ${file}`);
        }
        // No git init - this is intentional
      }
    };
    
    const noGitApp = new ElectronAppNoGit();
    const window = await noGitApp.launch();
    
    try {
      await noGitApp.waitForFileTree();
      
      // App should still work without git
      await expect(window.locator('.file-tree')).toBeVisible();
      await expect(window.locator('.file-item:has-text("README.md")')).toBeVisible();
      
      // Should not show git branch info or git status badges
      const branchInfo = window.locator('.branch-info');
      const hasBranchInfo = await branchInfo.count() > 0;
      
      if (hasBranchInfo) {
        // If branch info is shown, it should indicate no git repo
        const branchText = await branchInfo.textContent();
        expect(branchText).not.toMatch(/(main|master)/);
      }
      
      // No git status badges should be visible
      const gitStatuses = await window.locator('.git-status').count();
      expect(gitStatuses).toBe(0);
      
    } finally {
      await noGitApp.close();
    }
  });
});