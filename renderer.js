const fs = require('fs');
const path = require('path');
const { shell } = require('electron');
const { execSync } = require('child_process');

// Check if permission skipping is enabled
const skipPermissions = process.argv.includes('--skip-permissions');

// Enable hot reload in development
if (process.env.NODE_ENV !== 'production') {
  try {
    require('electron-reload')(__dirname, {
      electron: path.join(__dirname, 'node_modules', '.bin', 'electron'),
      hardResetMethod: 'exit'
    });
  } catch (e) {
    // electron-reload not available in production
  }
}

class FileExplorer {
  constructor() {
    this.currentPath = process.cwd();
    this.expandedFolders = new Set();
    this.fileTree = document.getElementById('file-tree');
    this.refreshBtn = document.getElementById('refresh-btn');
    this.breadcrumb = document.getElementById('breadcrumb');
    this.contextMenu = document.getElementById('context-menu');
    this.branchInfo = document.getElementById('branch-info');
    this.watchers = new Map();
    this.selectedItem = null;
    this.gitStatus = new Map();
    this.gitIgnorePatterns = [];
    this.isGitRepo = false;
    this.currentBranch = null;
    
    this.init();
  }

  init() {
    this.refreshBtn.addEventListener('click', () => this.refresh());
    this.checkGitRepository();
    this.updateBreadcrumb();
    this.loadFileTree();
    this.setupFileWatcher();
    this.setupContextMenu();
  }

  refresh() {
    this.fileTree.innerHTML = '';
    this.checkGitRepository();
    this.updateBreadcrumb();
    this.loadFileTree();
  }

  checkGitRepository() {
    try {
      // Check if we're in a git repository
      const gitDir = execSync('git rev-parse --git-dir', { 
        cwd: this.currentPath,
        encoding: 'utf8',
        stdio: 'pipe'
      }).trim();
      
      this.isGitRepo = true;
      
      // Get current branch
      try {
        this.currentBranch = execSync('git branch --show-current', {
          cwd: this.currentPath,
          encoding: 'utf8',
          stdio: 'pipe'
        }).trim();
      } catch (branchError) {
        this.currentBranch = null;
      }
      
      // Load git status
      this.loadGitStatus();
      
      // Load gitignore patterns
      this.loadGitIgnorePatterns();
      
      // Update branch display
      this.updateBranchInfo();
      
    } catch (error) {
      this.isGitRepo = false;
      this.currentBranch = null;
      this.gitStatus.clear();
      this.gitIgnorePatterns = [];
      this.updateBranchInfo();
    }
  }

  updateBranchInfo() {
    if (this.isGitRepo && this.currentBranch) {
      this.branchInfo.textContent = this.currentBranch;
      this.branchInfo.style.display = 'inline-block';
    } else {
      this.branchInfo.style.display = 'none';
    }
  }

  loadGitStatus() {
    if (!this.isGitRepo) return;
    
    try {
      const statusOutput = execSync('git status --porcelain', {
        cwd: this.currentPath,
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      this.gitStatus.clear();
      
      statusOutput.split('\n').forEach(line => {
        if (line.trim()) {
          const status = line.substring(0, 2);
          const filePath = line.substring(3);
          const fullPath = path.resolve(this.currentPath, filePath);
          this.gitStatus.set(fullPath, status);
        }
      });
    } catch (error) {
      console.error('Error loading git status:', error);
    }
  }

  loadGitIgnorePatterns() {
    if (!this.isGitRepo) return;
    
    try {
      const gitignorePath = path.join(this.currentPath, '.gitignore');
      if (fs.existsSync(gitignorePath)) {
        const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
        this.gitIgnorePatterns = gitignoreContent
          .split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('#'));
      }
    } catch (error) {
      console.error('Error loading gitignore:', error);
    }
  }

  isFileIgnored(filePath) {
    if (!this.isGitRepo || this.gitIgnorePatterns.length === 0) return false;
    
    const relativePath = path.relative(this.currentPath, filePath);
    
    return this.gitIgnorePatterns.some(pattern => {
      // Simple pattern matching - could be enhanced with proper glob matching
      if (pattern.endsWith('/')) {
        return relativePath.startsWith(pattern.slice(0, -1));
      }
      return relativePath === pattern || relativePath.includes(pattern);
    });
  }

  loadFileTree() {
    try {
      const items = this.getDirectoryContents(this.currentPath);
      this.renderTree(items, this.currentPath, 0);
    } catch (error) {
      console.error('Error loading file tree:', error);
    }
  }

  getDirectoryContents(dirPath) {
    try {
      const items = fs.readdirSync(dirPath);
      const result = [];

      for (const item of items) {
        if (item.startsWith('.')) continue; // Skip hidden files
        
        const fullPath = path.join(dirPath, item);
        
        try {
          const stats = fs.statSync(fullPath);
          
          // Get git status for this file
          const gitStatus = this.gitStatus.get(fullPath) || '';
          const isIgnored = this.isFileIgnored(fullPath);
          
          result.push({
            name: item,
            path: fullPath,
            isDirectory: stats.isDirectory(),
            size: stats.size,
            modified: stats.mtime,
            gitStatus: gitStatus,
            isIgnored: isIgnored
          });
        } catch (statError) {
          if (skipPermissions) {
            // When skipping permissions, add item with basic info
            result.push({
              name: item,
              path: fullPath,
              isDirectory: false, // Default to file if we can't stat
              size: 0,
              modified: new Date(),
              permissionDenied: true,
              gitStatus: '',
              isIgnored: false
            });
          } else {
            console.error('Permission denied accessing:', fullPath);
          }
        }
      }

      // Sort: directories first, then files, both alphabetically
      return result.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
    } catch (error) {
      console.error('Error reading directory:', error);
      return [];
    }
  }

  renderTree(items, basePath, depth) {
    for (const item of items) {
      const element = this.createTreeItem(item, depth);
      this.fileTree.appendChild(element);

      if (item.isDirectory && this.expandedFolders.has(item.path)) {
        const childItems = this.getDirectoryContents(item.path);
        this.renderTree(childItems, item.path, depth + 1);
      }
    }
  }

  createTreeItem(item, depth) {
    const div = document.createElement('div');
    div.className = `tree-item ${item.isDirectory ? 'folder' : 'file'} nested-${Math.min(depth, 5)}`;
    
    // Add git status classes
    if (item.gitStatus) {
      const status = item.gitStatus.trim();
      if (status.includes('M')) div.className += ' git-modified';
      if (status.includes('A')) div.className += ' git-added';
      if (status.includes('D')) div.className += ' git-deleted';
      if (status.includes('U')) div.className += ' git-unmerged';
      if (status.includes('?')) div.className += ' git-untracked';
    }
    
    if (item.permissionDenied) {
      div.className += ' permission-denied';
    }
    
    if (item.isIgnored) {
      div.className += ' git-ignored';
    }
    
    div.dataset.path = item.path;

    const icon = this.getIcon(item);
    const chevron = item.isDirectory ? 
      `<span class="chevron ${this.expandedFolders.has(item.path) ? 'expanded' : ''}">▶</span>` : 
      '<span class="chevron"></span>';

    const permissionIcon = item.permissionDenied ? '<span class="permission-icon">🔒</span>' : '';
    
    // Add git status indicator
    const gitStatusIndicator = this.getGitStatusIndicator(item.gitStatus);

    div.innerHTML = `
      ${chevron}
      <span class="icon">${icon}</span>
      <span class="name">${item.name}</span>
      ${gitStatusIndicator}
      ${permissionIcon}
    `;

    div.addEventListener('click', (e) => this.handleItemClick(e, item));
    div.addEventListener('dblclick', (e) => this.handleItemDoubleClick(e, item));
    div.addEventListener('contextmenu', (e) => this.handleContextMenu(e, item));

    return div;
  }

  getGitStatusIndicator(gitStatus) {
    if (!gitStatus || !this.isGitRepo) return '';
    
    const status = gitStatus.trim();
    const indicators = [];
    
    if (status.includes('M')) indicators.push('<span class="git-status-indicator git-modified">M</span>');
    if (status.includes('A')) indicators.push('<span class="git-status-indicator git-added">A</span>');
    if (status.includes('D')) indicators.push('<span class="git-status-indicator git-deleted">D</span>');
    if (status.includes('U')) indicators.push('<span class="git-status-indicator git-unmerged">U</span>');
    if (status.includes('?')) indicators.push('<span class="git-status-indicator git-untracked">?</span>');
    
    return indicators.length > 0 ? `<span class="git-status">${indicators.join('')}</span>` : '';
  }

  getIcon(item) {
    if (item.isDirectory) {
      return '📁';
    }
    
    const ext = path.extname(item.name).toLowerCase();
    const iconMap = {
      '.js': '📄',
      '.ts': '📄',
      '.html': '🌐',
      '.css': '🎨',
      '.json': '📋',
      '.md': '📝',
      '.txt': '📄',
      '.png': '🖼️',
      '.jpg': '🖼️',
      '.jpeg': '🖼️',
      '.gif': '🖼️',
      '.svg': '🖼️',
      '.pdf': '📕',
      '.zip': '📦',
      '.tar': '📦',
      '.gz': '📦'
    };

    return iconMap[ext] || '📄';
  }

  handleItemClick(e, item) {
    e.stopPropagation();
    
    // Remove previous selection
    document.querySelectorAll('.tree-item.selected').forEach(el => {
      el.classList.remove('selected');
    });
    
    // Add selection to current item
    e.currentTarget.classList.add('selected');

    if (item.isDirectory) {
      this.toggleFolder(item.path);
    }
  }

  handleItemDoubleClick(e, item) {
    e.stopPropagation();
    
    if (!item.isDirectory) {
      // Open file with default application
      shell.openPath(item.path);
    }
  }

  toggleFolder(folderPath) {
    const isExpanded = this.expandedFolders.has(folderPath);
    
    if (isExpanded) {
      this.expandedFolders.delete(folderPath);
    } else {
      this.expandedFolders.add(folderPath);
    }

    this.refresh();
  }

  updateBreadcrumb() {
    const parts = this.currentPath.split(path.sep).filter(part => part !== '');
    const homeDir = require('os').homedir();
    const username = require('os').userInfo().username;
    
    this.breadcrumb.innerHTML = '';
    
    // Add root/home indicator
    const rootPath = path.sep;
    const rootItem = document.createElement('span');
    rootItem.className = 'breadcrumb-item';
    rootItem.textContent = this.currentPath === homeDir ? username : '/';
    rootItem.addEventListener('click', () => this.navigateToPath(this.currentPath === homeDir ? homeDir : rootPath));
    this.breadcrumb.appendChild(rootItem);
    
    // Build cumulative path and add breadcrumb items
    let cumulativePath = '';
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      cumulativePath = path.join(cumulativePath, path.sep, part);
      
      // Add separator
      const separator = document.createElement('span');
      separator.className = 'breadcrumb-separator';
      separator.textContent = '>';
      this.breadcrumb.appendChild(separator);
      
      // Add breadcrumb item
      const item = document.createElement('span');
      item.className = 'breadcrumb-item';
      if (i === parts.length - 1) {
        item.classList.add('current');
      }
      
      // Show username if this is the home directory
      if (cumulativePath === homeDir) {
        item.textContent = username;
      } else {
        item.textContent = part;
      }
      
      const targetPath = cumulativePath;
      item.addEventListener('click', () => this.navigateToPath(targetPath));
      this.breadcrumb.appendChild(item);
    }
  }

  navigateToPath(targetPath) {
    this.currentPath = targetPath;
    this.expandedFolders.clear(); // Clear expanded state when navigating
    this.setupFileWatcher(); // Setup watcher for new path
    this.refresh();
  }

  setupFileWatcher() {
    // Clear existing watchers
    this.watchers.forEach(watcher => watcher.close());
    this.watchers.clear();

    // Watch current directory
    this.watchDirectory(this.currentPath);

    // Watch expanded folders
    this.expandedFolders.forEach(folderPath => {
      this.watchDirectory(folderPath);
    });

    // Watch git directory for commits and branch changes
    this.watchGitDirectory();
  }

  watchDirectory(dirPath) {
    try {
      if (this.watchers.has(dirPath)) {
        return; // Already watching this directory
      }

      const watcher = fs.watch(dirPath, { recursive: false }, (eventType, filename) => {
        if (filename && !filename.startsWith('.')) {
          // Debounce the refresh to avoid excessive updates
          clearTimeout(this.refreshTimeout);
          this.refreshTimeout = setTimeout(() => {
            // Refresh git status when files change
            if (this.isGitRepo) {
              this.loadGitStatus();
            }
            this.refresh();
          }, 100);
        }
      });

      this.watchers.set(dirPath, watcher);
    } catch (error) {
      console.error('Error watching directory:', dirPath, error);
    }
  }

  watchGitDirectory() {
    if (!this.isGitRepo) return;

    try {
      const gitDir = path.join(this.currentPath, '.git');
      if (!fs.existsSync(gitDir)) return;

      // Watch for changes in .git directory (commits, branch changes, etc.)
      const gitWatcher = fs.watch(gitDir, { recursive: true }, (eventType, filename) => {
        // Only refresh git status for relevant git files
        if (filename && (
          filename.includes('HEAD') || 
          filename.includes('index') || 
          filename.includes('refs/') ||
          filename.includes('logs/')
        )) {
          clearTimeout(this.gitRefreshTimeout);
          this.gitRefreshTimeout = setTimeout(() => {
            this.loadGitStatus();
            this.checkGitRepository(); // This will update branch info too
            this.refresh();
          }, 200);
        }
      });

      this.watchers.set(gitDir, gitWatcher);
    } catch (error) {
      console.error('Error watching git directory:', error);
    }
  }

  toggleFolder(folderPath) {
    const isExpanded = this.expandedFolders.has(folderPath);
    
    if (isExpanded) {
      this.expandedFolders.delete(folderPath);
      // Remove watcher for collapsed folder
      if (this.watchers.has(folderPath)) {
        this.watchers.get(folderPath).close();
        this.watchers.delete(folderPath);
      }
    } else {
      this.expandedFolders.add(folderPath);
      // Add watcher for expanded folder
      this.watchDirectory(folderPath);
    }

    this.refresh();
  }

  setupContextMenu() {
    // Hide context menu when clicking elsewhere
    document.addEventListener('click', (e) => {
      if (!this.contextMenu.contains(e.target)) {
        this.hideContextMenu();
      }
    });

    // Handle right-click on empty space
    this.fileTree.addEventListener('contextmenu', (e) => {
      if (e.target === this.fileTree) {
        this.handleContextMenu(e, null);
      }
    });
  }

  handleContextMenu(e, item) {
    e.preventDefault();
    e.stopPropagation();
    
    this.selectedItem = item;
    this.showContextMenu(e.clientX, e.clientY, item);
  }

  showContextMenu(x, y, item) {
    this.contextMenu.innerHTML = '';
    
    if (item) {
      // File/folder specific options
      this.addContextMenuItem('📝', 'Rename', () => this.renameItem(item));
      this.addContextMenuItem('🗑️', 'Delete', () => this.deleteItem(item));
      this.addContextMenuSeparator();
    }
    
    // General options (available for empty space too)
    const targetDir = item && item.isDirectory ? item.path : this.currentPath;
    this.addContextMenuItem('📄', 'New File', () => this.createNewFile(targetDir));
    this.addContextMenuItem('📁', 'New Folder', () => this.createNewFolder(targetDir));
    
    if (item) {
      this.addContextMenuSeparator();
      this.addContextMenuItem('📂', 'Reveal in File Manager', () => this.revealInFileManager(item));
    }

    // Position and show menu
    this.contextMenu.style.left = `${x}px`;
    this.contextMenu.style.top = `${y}px`;
    this.contextMenu.style.display = 'block';

    // Adjust position if menu goes off-screen
    const rect = this.contextMenu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      this.contextMenu.style.left = `${x - rect.width}px`;
    }
    if (rect.bottom > window.innerHeight) {
      this.contextMenu.style.top = `${y - rect.height}px`;
    }
  }

  hideContextMenu() {
    this.contextMenu.style.display = 'none';
  }

  addContextMenuItem(icon, text, onClick) {
    const item = document.createElement('div');
    item.className = 'context-menu-item';
    item.innerHTML = `<span class="icon">${icon}</span>${text}`;
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
      this.hideContextMenu();
    });
    this.contextMenu.appendChild(item);
  }

  addContextMenuSeparator() {
    const separator = document.createElement('div');
    separator.className = 'context-menu-separator';
    this.contextMenu.appendChild(separator);
  }

  renameItem(item) {
    const element = document.querySelector(`[data-path="${item.path}"]`);
    if (!element) return;

    // Check if already editing
    if (element.classList.contains('editing')) return;

    element.classList.add('editing');
    const nameSpan = element.querySelector('.name');
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'inline-input';
    input.value = item.name;
    
    // Store reference to current item for the event handlers
    const currentItem = item;
    
    const finishRename = () => {
      const newName = input.value.trim();
      if (newName && newName !== currentItem.name) {
        const newPath = path.join(path.dirname(currentItem.path), newName);
        try {
          fs.renameSync(currentItem.path, newPath);
          // File watcher will handle the refresh
        } catch (error) {
          if (skipPermissions) {
            console.warn(`Permission denied renaming ${currentItem.path}, operation skipped`);
            alert(`Permission denied: Cannot rename "${currentItem.name}"`);
          } else {
            alert(`Error renaming: ${error.message}`);
          }
        }
      }
      this.cancelRename(element);
    };
    
    const cancelRename = () => {
      this.cancelRename(element);
    };
    
    input.addEventListener('blur', finishRename);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        finishRename();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelRename();
      }
    });
    
    nameSpan.parentNode.insertBefore(input, nameSpan.nextSibling);
    input.focus();
    input.select();
  }


  cancelRename(element) {
    element.classList.remove('editing');
    const input = element.querySelector('.inline-input');
    if (input) {
      input.remove();
    }
  }

  deleteItem(item) {
    const confirmMessage = item.isDirectory 
      ? `Are you sure you want to delete the folder "${item.name}" and all its contents?`
      : `Are you sure you want to delete the file "${item.name}"?`;
    
    if (confirm(confirmMessage)) {
      try {
        if (item.isDirectory) {
          fs.rmSync(item.path, { recursive: true, force: skipPermissions });
        } else {
          fs.unlinkSync(item.path);
        }
        // File watcher will handle the refresh
      } catch (error) {
        if (skipPermissions) {
          console.warn(`Permission denied deleting ${item.path}, operation skipped`);
          alert(`Permission denied: Cannot delete "${item.name}"`);
        } else {
          alert(`Error deleting: ${error.message}`);
        }
      }
    }
  }

  createNewFile(targetDir) {
    const name = prompt('Enter file name:');
    if (name && name.trim()) {
      const filePath = path.join(targetDir, name.trim());
      try {
        fs.writeFileSync(filePath, '');
        // File watcher will handle the refresh
      } catch (error) {
        if (skipPermissions) {
          console.warn(`Permission denied creating file ${filePath}, operation skipped`);
          alert(`Permission denied: Cannot create file "${name.trim()}"`);
        } else {
          alert(`Error creating file: ${error.message}`);
        }
      }
    }
  }

  createNewFolder(targetDir) {
    const name = prompt('Enter folder name:');
    if (name && name.trim()) {
      const folderPath = path.join(targetDir, name.trim());
      try {
        fs.mkdirSync(folderPath);
        // File watcher will handle the refresh
      } catch (error) {
        if (skipPermissions) {
          console.warn(`Permission denied creating folder ${folderPath}, operation skipped`);
          alert(`Permission denied: Cannot create folder "${name.trim()}"`);
        } else {
          alert(`Error creating folder: ${error.message}`);
        }
      }
    }
  }

  revealInFileManager(item) {
    shell.showItemInFolder(item.path);
  }

  cleanup() {
    // Clean up watchers when the app closes
    this.watchers.forEach(watcher => watcher.close());
    this.watchers.clear();
  }
}

// Initialize the file explorer when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const fileExplorer = new FileExplorer();
  
  // Clean up watchers when the window is closed
  window.addEventListener('beforeunload', () => {
    fileExplorer.cleanup();
  });
});