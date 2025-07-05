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
    
    // Launch the Electron app with optimizations
    this.app = await electron.launch({
      args: [
        path.join(__dirname, '../../main.js'), 
        this.testDir, 
        '--no-sandbox',
        '--disable-dev-shm-usage', // Reduce memory usage
        '--disable-extensions',     // Disable extensions for speed
        ...args
      ],
      env: { ...process.env, NODE_ENV: 'test' },
      timeout: 10000 // Faster launch timeout
    });
    
    // Get the main window and wait for it to be ready
    this.window = await this.app.firstWindow();
    await this.window.waitForLoadState('domcontentloaded', { timeout: 5000 });
    
    return this.window;
  }

  async setupTestFiles() {
    // Create test directory structure and files in batch
    const structure = {
      'README.md': '# Test Project\nThis is a test project.',
      'package.json': '{"name": "test-project", "version": "1.0.0"}',
      'src/index.js': 'console.log("main");',
      'src/utils.js': 'export function util() {}',
      'tests/test.js': 'test("example", () => {});',
      'docs/guide.md': '# Guide\nTest documentation.'
    };

    // Create all directories and files efficiently
    for (const [filePath, content] of Object.entries(structure)) {
      const fullPath = path.join(this.testDir, filePath);
      const dir = path.dirname(fullPath);
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Write file
      fs.writeFileSync(fullPath, content);
    }

    // Initialize git repo for git-related tests (optimized)
    try {
      const { execSync } = require('child_process');
      // Use single command with && to reduce overhead
      execSync('git init && git config user.name "Test User" && git config user.email "test@example.com" && git add . && git commit -m "Initial commit"', { 
        cwd: this.testDir, 
        stdio: 'ignore',
        timeout: 5000 // Add timeout to prevent hanging
      });
    } catch (error) {
      // Git not available or failed - tests will handle this gracefully
      console.warn('Git setup failed, some tests may not work:', error.message);
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
    // Wait for the file tree to be populated (optimized)
    await this.window.waitForSelector('.file-tree', { timeout: 3000 });
    await this.window.waitForFunction(() => {
      const fileTree = document.querySelector('.file-tree');
      return fileTree && fileTree.children.length > 0;
    }, { timeout: 3000 });
  }

  async getFileTreeItems() {
    await this.waitForFileTree();
    return await this.window.locator('.tree-item').all();
  }

  async getBreadcrumbs() {
    return await this.window.locator('.breadcrumb-item').all();
  }
}

module.exports = ElectronApp;