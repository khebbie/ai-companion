const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');

class ElectronApp {
  constructor() {
    this.app = null;
    this.window = null;
    this.testDir = null;
  }

  async launch(args = []) {
    // Create a temporary test directory
    this.testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-companion-test-'));
    
    // Create some test files and folders
    await this.setupTestFiles();
    
    // Launch the Electron app
    this.app = await electron.launch({
      args: [path.join(__dirname, '../../main.js'), this.testDir, '--no-sandbox', ...args],
      env: { ...process.env, NODE_ENV: 'test' }
    });
    
    // Get the main window
    this.window = await this.app.firstWindow();
    await this.window.waitForLoadState('domcontentloaded');
    
    return this.window;
  }

  async setupTestFiles() {
    // Create test directory structure
    const dirs = ['src', 'tests', 'docs'];
    const files = [
      'README.md',
      'package.json',
      'src/index.js',
      'src/utils.js',
      'tests/test.js',
      'docs/guide.md'
    ];

    for (const dir of dirs) {
      fs.mkdirSync(path.join(this.testDir, dir), { recursive: true });
    }

    for (const file of files) {
      const filePath = path.join(this.testDir, file);
      fs.writeFileSync(filePath, `// Test content for ${file}`);
    }

    // Initialize git repo for git-related tests
    try {
      const { execSync } = require('child_process');
      execSync('git init', { cwd: this.testDir, stdio: 'ignore' });
      execSync('git config user.name "Test User"', { cwd: this.testDir, stdio: 'ignore' });
      execSync('git config user.email "test@example.com"', { cwd: this.testDir, stdio: 'ignore' });
      execSync('git add .', { cwd: this.testDir, stdio: 'ignore' });
      execSync('git commit -m "Initial commit"', { cwd: this.testDir, stdio: 'ignore' });
    } catch (error) {
      // Git not available or failed - tests will handle this gracefully
    }
  }

  async close() {
    if (this.app) {
      await this.app.close();
    }
    
    // Clean up test directory
    if (this.testDir && fs.existsSync(this.testDir)) {
      fs.rmSync(this.testDir, { recursive: true, force: true });
    }
  }

  async waitForFileTree() {
    // Wait for the file tree to be populated
    await this.window.waitForSelector('.file-tree', { timeout: 5000 });
    await this.window.waitForFunction(() => {
      const fileTree = document.querySelector('.file-tree');
      return fileTree && fileTree.children.length > 0;
    });
  }

  async getFileTreeItems() {
    await this.waitForFileTree();
    return await this.window.locator('.file-item').all();
  }

  async getBreadcrumbs() {
    return await this.window.locator('.breadcrumb-item').all();
  }
}

module.exports = ElectronApp;