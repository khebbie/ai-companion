const fs = require('fs');
const path = require('path');
const { shell, ipcRenderer } = require('electron');
const { execSync } = require('child_process');
const ClaudeCodeIntegration = require('./claude-integration');

// Check if permission skipping is enabled
const skipPermissions = process.argv.includes('--skip-permissions');

// Get initial directory from command line arguments
function getInitialDirectory() {
  const args = process.argv;
  const initialDirIndex = args.indexOf('--initial-directory');
  if (initialDirIndex !== -1 && initialDirIndex + 1 < args.length) {
    return args[initialDirIndex + 1];
  }
  return process.cwd();
}

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
    this.currentPath = getInitialDirectory();
    this.expandedFolders = new Set();
    this.fileTree = document.getElementById('file-tree');
    this.refreshBtn = document.getElementById('refresh-btn');
    this.breadcrumb = document.getElementById('breadcrumb');
    this.contextMenu = document.getElementById('context-menu');
    this.branchInfo = document.getElementById('branch-info');
    this.watchers = new Map();
    this.selectedItem = null;
    this.focusedItem = null;
    this.visibleItems = [];
    this.showHiddenFiles = false;
    this.showDetails = false;
    this.gitStatus = new Map();
    this.gitIgnorePatterns = [];
    this.isGitRepo = false;
    this.currentBranch = null;
    this.gitRepoRoot = null;
    
    // Claude Code integration
    this.claudePanel = document.getElementById('claude-panel');
    this.claudePanelToggle = document.getElementById('claude-panel-toggle');
    this.claudeStatus = document.getElementById('claude-status');
    this.sessionId = document.getElementById('session-id');
    this.currentActivity = document.getElementById('current-activity');
    this.contextFiles = document.getElementById('context-files');
    this.activeFilesList = document.getElementById('active-files-list');
    this.claudeConnectBtn = document.getElementById('claude-connect-btn');
    this.sessionDropdown = document.getElementById('session-dropdown');
    this.sessionProject = document.getElementById('session-project');
    
    // Initialize Claude Code integration
    this.claudeIntegration = new ClaudeCodeIntegration();
    this.claudeSession = {
      connected: false,
      sessionId: null,
      activity: 'Idle',
      activeFiles: [],
      contextFileCount: 0,
      availableSessions: [],
      currentSession: null
    };
    
    this.init();
  }

  init() {
    this.refreshBtn.addEventListener('click', () => this.refresh());
    this.checkGitRepository();
    this.updateBreadcrumb();
    this.loadFileTree();
    this.setupFileWatcher();
    this.setupContextMenu();
    this.setupKeyboardNavigation();
    this.setupClaudePanel();
  }

  refresh() {
    this.fileTree.innerHTML = '';
    this.visibleItems = [];
    this.checkGitRepository();
    this.updateBreadcrumb();
    this.loadFileTree();
    this.updateFocusAfterRefresh();
  }

  checkGitRepository() {
    try {
      // Find the git repository root
      const gitRepoRoot = execSync('git rev-parse --show-toplevel', { 
        cwd: this.currentPath,
        encoding: 'utf8',
        stdio: 'pipe'
      }).trim();
      
      this.isGitRepo = true;
      this.gitRepoRoot = gitRepoRoot;
      
      // Get current branch
      try {
        this.currentBranch = execSync('git branch --show-current', {
          cwd: this.gitRepoRoot,
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
      this.gitRepoRoot = null;
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
    if (!this.isGitRepo || !this.gitRepoRoot) return;
    
    try {
      const statusOutput = execSync('git status --porcelain', {
        cwd: this.gitRepoRoot,
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      this.gitStatus.clear();
      
      statusOutput.split('\n').forEach(line => {
        if (line.trim()) {
          const status = line.substring(0, 2);
          const filePath = line.substring(3);
          const fullPath = path.resolve(this.gitRepoRoot, filePath);
          this.gitStatus.set(fullPath, status);
        }
      });
    } catch (error) {
      console.error('Error loading git status:', error);
    }
  }

  loadGitIgnorePatterns() {
    if (!this.isGitRepo || !this.gitRepoRoot) return;
    
    try {
      const gitignorePath = path.join(this.gitRepoRoot, '.gitignore');
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
    if (!this.isGitRepo || !this.gitRepoRoot || this.gitIgnorePatterns.length === 0) return false;
    
    const relativePath = path.relative(this.gitRepoRoot, filePath);
    
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
        const fullPath = path.join(dirPath, item);
        const isHiddenFile = item.startsWith('.');
        const isIgnored = this.isFileIgnored(fullPath);
        
        // Skip hidden files and gitignored files unless toggle is on
        if ((isHiddenFile || isIgnored) && !this.showHiddenFiles) continue;
        
        try {
          const stats = fs.statSync(fullPath);
          
          // Get git status for this file
          const gitStatus = this.gitStatus.get(fullPath) || '';
          
          result.push({
            name: item,
            path: fullPath,
            isDirectory: stats.isDirectory(),
            size: stats.size,
            modified: stats.mtime,
            gitStatus: gitStatus,
            isIgnored: isIgnored,
            isHiddenFile: isHiddenFile
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
              isIgnored: isIgnored,
              isHiddenFile: isHiddenFile
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
      this.visibleItems.push({ item, element });

      if (item.isDirectory && this.expandedFolders.has(item.path)) {
        const childItems = this.getDirectoryContents(item.path);
        this.renderTree(childItems, item.path, depth + 1);
      }
    }
  }

  createTreeItem(item, depth) {
    const div = document.createElement('div');
    div.className = `tree-item ${item.isDirectory ? 'folder' : 'file'} nested-${Math.min(depth, 5)}`;
    
    // Add classes for hidden files and gitignored files
    if (item.isHiddenFile) {
      div.className += ' hidden-file';
    }
    if (item.isIgnored) {
      div.className += ' gitignored-file';
    }
    
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
    
    div.dataset.path = item.path;

    const icon = this.getIcon(item);
    const chevron = item.isDirectory ? 
      `<span class="chevron ${this.expandedFolders.has(item.path) ? 'expanded' : ''}">▶</span>` : 
      '<span class="chevron"></span>';

    const permissionIcon = item.permissionDenied ? '<span class="permission-icon">🔒</span>' : '';
    
    // Add git status indicator
    const gitStatusIndicator = this.getGitStatusIndicator(item.gitStatus);

    // Add file details if details view is enabled
    const detailsInfo = this.showDetails ? this.getDetailsInfo(item) : '';

    div.innerHTML = `
      ${chevron}
      <span class="icon">${icon}</span>
      <span class="name">${item.name}</span>
      ${detailsInfo}
      ${gitStatusIndicator}
      ${permissionIcon}
    `;

    div.addEventListener('click', (e) => this.handleItemClick(e, item));
    div.addEventListener('dblclick', (e) => this.handleItemDoubleClick(e, item));
    div.addEventListener('contextmenu', (e) => this.handleContextMenu(e, item));

    return div;
  }

  getDetailsInfo(item) {
    if (!this.showDetails) return '';
    
    const sizeInfo = item.isDirectory ? 
      '<span class="file-size">--</span>' : 
      `<span class="file-size">${this.formatFileSize(item.size)}</span>`;
    
    const modifiedInfo = item.permissionDenied ? 
      '<span class="file-modified">--</span>' : 
      `<span class="file-modified">${this.formatLastModified(item.modified)}</span>`;
    
    return `<span class="file-details">${sizeInfo}<span class="detail-separator">•</span>${modifiedInfo}</span>`;
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
    
    if (item.isDirectory) {
      // Change application focus to the double-clicked folder
      this.setApplicationFocus(item.path);
    } else {
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
    const rootTargetPath = this.currentPath === homeDir ? homeDir : rootPath;
    rootItem.addEventListener('click', () => this.navigateToPath(rootTargetPath));
    rootItem.addEventListener('dblclick', () => this.setApplicationFocus(rootTargetPath));
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
      item.addEventListener('dblclick', () => this.setApplicationFocus(targetPath));
      this.breadcrumb.appendChild(item);
    }
  }

  navigateToPath(targetPath) {
    this.currentPath = targetPath;
    this.expandedFolders.clear(); // Clear expanded state when navigating
    this.setupFileWatcher(); // Setup watcher for new path
    this.refresh();
  }

  setApplicationFocus(targetPath) {
    // Change application's current working directory focus
    try {
      process.chdir(targetPath);
      this.currentPath = targetPath;
      this.expandedFolders.clear(); // Clear expanded state when changing focus
      this.setupFileWatcher(); // Setup watcher for new path
      this.refresh();
      console.log(`Application focus changed to: ${targetPath}`);
    } catch (error) {
      console.error('Error changing application focus:', error);
      // Fallback to navigation if changing working directory fails
      this.navigateToPath(targetPath);
    }
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
    if (!this.isGitRepo || !this.gitRepoRoot) return;

    try {
      const gitDir = path.join(this.gitRepoRoot, '.git');
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

    // Also hide on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
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
      this.addContextMenuItem('🤖', 'Add to Claude Context', () => this.addFileToClaudeContext(item.path));
      this.addContextMenuItem('📂', 'Reveal in File Manager', () => this.revealInFileManager(item));
      this.addContextMenuItem('🚀', 'Open new AI Companion here', () => this.openNewAICompanion(item));
    } else {
      // Context menu for empty space
      this.addContextMenuSeparator();
      this.addContextMenuItem('🤖', 'Add Selected Files to Claude', () => this.addSelectedFilesToClaudeContext());
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

  async openNewAICompanion(item) {
    // Determine the target directory
    const targetDir = item.isDirectory ? item.path : path.dirname(item.path);
    
    try {
      // Use IPC to communicate with main process
      const result = await ipcRenderer.invoke('open-new-ai-companion', targetDir);
      
      if (result.success) {
        console.log(result.message);
      } else {
        console.error('Failed to open new AI Companion:', result.message);
        alert(`Failed to open new AI Companion window. Error: ${result.message}`);
      }
    } catch (error) {
      console.error('IPC communication error:', error);
      alert(`Failed to communicate with main process. Error: ${error.message}`);
    }
  }

  setupKeyboardNavigation() {
    // Make the file tree focusable
    this.fileTree.setAttribute('tabindex', '0');
    
    // Focus the file tree on page load
    this.fileTree.focus();
    
    document.addEventListener('keydown', (e) => {
      // Only handle navigation if file tree is focused or no other input is active
      if (document.activeElement !== this.fileTree && 
          !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        // Auto-focus file tree for navigation keys
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'j', 'k', 'h', 'l', 'Enter', ' '].includes(e.key)) {
          this.fileTree.focus();
        }
      }
      
      if (document.activeElement === this.fileTree || 
          !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        this.handleKeyboardNavigation(e);
      }
      
      // Handle global shortcuts that work regardless of focus
      this.handleGlobalShortcuts(e);
    });
    
    // Handle focus events
    this.fileTree.addEventListener('focus', () => {
      if (!this.focusedItem && this.visibleItems.length > 0) {
        this.setFocusedItem(0);
      }
    });
  }

  handleKeyboardNavigation(e) {
    if (this.visibleItems.length === 0) return;
    
    const currentIndex = this.getCurrentFocusIndex();
    
    switch (e.key) {
      case 'ArrowUp':
      case 'k':
        e.preventDefault();
        this.navigateUp(currentIndex);
        break;
        
      case 'ArrowDown':
      case 'j':
        e.preventDefault();
        this.navigateDown(currentIndex);
        break;
        
      case 'ArrowLeft':
      case 'h':
        e.preventDefault();
        this.navigateLeft(currentIndex);
        break;
        
      case 'ArrowRight':
      case 'l':
        e.preventDefault();
        this.navigateRight(currentIndex);
        break;
        
      case 'Enter':
        e.preventDefault();
        this.handleEnterKey(currentIndex);
        break;
        
      case ' ':
        e.preventDefault();
        this.handleSpaceKey(currentIndex);
        break;
    }
  }

  getCurrentFocusIndex() {
    if (!this.focusedItem) return 0;
    
    return this.visibleItems.findIndex(({ item }) => 
      item.path === this.focusedItem.path
    );
  }

  setFocusedItem(index) {
    // Remove previous focus
    if (this.focusedItem) {
      const prevElement = document.querySelector(`[data-path="${this.focusedItem.path}"]`);
      if (prevElement) {
        prevElement.classList.remove('keyboard-focused');
      }
    }
    
    // Set new focus
    if (index >= 0 && index < this.visibleItems.length) {
      this.focusedItem = this.visibleItems[index].item;
      const element = this.visibleItems[index].element;
      element.classList.add('keyboard-focused');
      
      // Scroll into view if needed
      element.scrollIntoView({ block: 'nearest' });
    }
  }

  navigateUp(currentIndex) {
    if (currentIndex > 0) {
      this.setFocusedItem(currentIndex - 1);
    }
  }

  navigateDown(currentIndex) {
    if (currentIndex < this.visibleItems.length - 1) {
      this.setFocusedItem(currentIndex + 1);
    }
  }

  navigateLeft(currentIndex) {
    if (currentIndex === -1) return;
    
    const { item } = this.visibleItems[currentIndex];
    
    if (item.isDirectory && this.expandedFolders.has(item.path)) {
      // Collapse the folder
      this.toggleFolder(item.path);
    } else {
      // Navigate to parent directory (find parent in visible items)
      const parentPath = path.dirname(item.path);
      const parentIndex = this.visibleItems.findIndex(({ item: parentItem }) => 
        parentItem.path === parentPath && parentItem.isDirectory
      );
      
      if (parentIndex !== -1) {
        this.setFocusedItem(parentIndex);
      }
    }
  }

  navigateRight(currentIndex) {
    if (currentIndex === -1) return;
    
    const { item } = this.visibleItems[currentIndex];
    
    if (item.isDirectory) {
      if (!this.expandedFolders.has(item.path)) {
        // Expand the folder
        this.toggleFolder(item.path);
      } else {
        // Navigate to first child if expanded
        const nextIndex = currentIndex + 1;
        if (nextIndex < this.visibleItems.length) {
          this.setFocusedItem(nextIndex);
        }
      }
    }
  }

  handleEnterKey(currentIndex) {
    if (currentIndex === -1) return;
    
    const { item } = this.visibleItems[currentIndex];
    
    if (item.isDirectory) {
      this.toggleFolder(item.path);
    } else {
      // Open file with default application
      shell.openPath(item.path);
    }
  }

  handleSpaceKey(currentIndex) {
    if (currentIndex === -1) return;
    
    const { item, element } = this.visibleItems[currentIndex];
    
    // Toggle selection (same as click behavior)
    document.querySelectorAll('.tree-item.selected').forEach(el => {
      el.classList.remove('selected');
    });
    
    element.classList.add('selected');
    this.selectedItem = item;
  }

  handleGlobalShortcuts(e) {
    // Use Command key on Mac, Ctrl on Windows/Linux
    const modifierKey = process.platform === 'darwin' ? e.metaKey : e.ctrlKey;
    
    // Handle Cmd/Ctrl+H for toggling hidden files
    if (modifierKey && e.key === 'h') {
      e.preventDefault();
      this.toggleHiddenFiles();
    }
    
    // Handle Cmd/Ctrl+D for toggling details view
    if (modifierKey && e.key === 'd') {
      e.preventDefault();
      this.toggleDetailsView();
    }
  }

  toggleHiddenFiles() {
    this.showHiddenFiles = !this.showHiddenFiles;
    console.log(`Hidden & ignored files ${this.showHiddenFiles ? 'shown' : 'hidden'}`);
    
    // Update the header to show current state
    this.updateHiddenFilesIndicator();
    
    // Refresh the file tree to show/hide hidden files
    this.refresh();
  }

  updateHiddenFilesIndicator() {
    // Find or create the hidden files indicator
    let indicator = document.getElementById('hidden-files-indicator');
    if (!indicator) {
      indicator = document.createElement('span');
      indicator.id = 'hidden-files-indicator';
      indicator.className = 'hidden-files-indicator';
      
      // Add to header next to branch info
      const headerRight = document.querySelector('.header-right');
      headerRight.insertBefore(indicator, headerRight.firstChild);
    }
    
    if (this.showHiddenFiles) {
      indicator.textContent = 'Show Hidden & Ignored';
      indicator.style.display = 'inline-block';
    } else {
      indicator.style.display = 'none';
    }
  }

  toggleDetailsView() {
    this.showDetails = !this.showDetails;
    console.log(`Details view ${this.showDetails ? 'enabled' : 'disabled'}`);
    
    // Update the header to show current state
    this.updateDetailsIndicator();
    
    // Refresh the file tree to show/hide details
    this.refresh();
  }

  updateDetailsIndicator() {
    // Find or create the details indicator
    let indicator = document.getElementById('details-indicator');
    if (!indicator) {
      indicator = document.createElement('span');
      indicator.id = 'details-indicator';
      indicator.className = 'details-indicator';
      
      // Add to header next to other indicators
      const headerRight = document.querySelector('.header-right');
      headerRight.insertBefore(indicator, headerRight.firstChild);
    }
    
    if (this.showDetails) {
      indicator.textContent = 'Details';
      indicator.style.display = 'inline-block';
    } else {
      indicator.style.display = 'none';
    }
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  formatLastModified(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    
    if (diffHours < 1) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return diffMinutes < 1 ? 'just now' : `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return diffDays === 1 ? 'yesterday' : `${diffDays}d ago`;
    } else if (diffWeeks < 4) {
      return `${diffWeeks}w ago`;
    } else if (diffMonths < 12) {
      return `${diffMonths}mo ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  updateFocusAfterRefresh() {
    // Try to maintain focus on the same item after refresh
    if (this.focusedItem) {
      const newIndex = this.visibleItems.findIndex(({ item }) => 
        item.path === this.focusedItem.path
      );
      
      if (newIndex !== -1) {
        this.setFocusedItem(newIndex);
      } else {
        // Item no longer exists, focus first item
        if (this.visibleItems.length > 0) {
          this.setFocusedItem(0);
        } else {
          this.focusedItem = null;
        }
      }
    }
  }

  setupClaudePanel() {
    // Set up Claude panel toggle
    this.claudePanelToggle.addEventListener('click', () => {
      this.claudePanel.classList.toggle('collapsed');
      this.claudePanelToggle.textContent = this.claudePanel.classList.contains('collapsed') ? '+' : '−';
    });
    
    // Set up Claude Code integration event listeners
    this.claudeIntegration.on('connectionChanged', (status) => {
      this.claudeSession.connected = status.connected;
      this.updateClaudePanel();
      
      // Show connect button if disconnected
      if (!status.connected) {
        this.claudeConnectBtn.style.display = 'inline-block';
        console.log('Claude Code not connected:', status.error || 'Unknown reason');
      } else {
        this.claudeConnectBtn.style.display = 'none';
      }
    });
    
    // Add connect button handler
    this.claudeConnectBtn.addEventListener('click', async () => {
      try {
        await this.claudeIntegration.initialize();
      } catch (error) {
        console.error('Failed to connect to Claude Code:', error);
      }
    });
    
    this.claudeIntegration.on('sessionChanged', (session) => {
      this.claudeSession.sessionId = session ? session.id : null;
      this.claudeSession.currentSession = session;
      this.updateClaudePanel();
    });
    
    this.claudeIntegration.on('sessionsDiscovered', (sessions) => {
      this.claudeSession.availableSessions = sessions;
      this.updateSessionDropdown();
    });
    
    // Handle session dropdown changes
    this.sessionDropdown.addEventListener('change', (e) => {
      const sessionId = e.target.value;
      if (sessionId) {
        this.claudeIntegration.switchToSession(sessionId);
      }
    });
    
    this.claudeIntegration.on('activityChanged', (activity) => {
      this.claudeSession.activity = activity;
      this.updateClaudePanel();
    });
    
    this.claudeIntegration.on('filesChanged', (files) => {
      this.claudeSession.activeFiles = files;
      this.claudeSession.contextFileCount = files.length;
      this.updateClaudePanel();
      
      // Highlight files in the tree that Claude is working with
      this.highlightClaudeFiles(files);
    });
    
    this.claudeIntegration.on('error', (error) => {
      console.error('Claude Code error:', error);
      // Could show error in UI
    });
    
    // Initialize Claude panel state
    this.updateClaudePanel();
  }
  
  updateClaudePanel() {
    // Update status indicator
    const statusIndicator = this.claudeStatus.querySelector('.status-indicator');
    const statusText = this.claudeStatus.querySelector('.status-text');
    
    if (this.claudeSession.connected) {
      statusIndicator.className = 'status-indicator connected';
      statusText.textContent = 'Connected to Claude Code';
    } else {
      statusIndicator.className = 'status-indicator disconnected';
      statusText.textContent = this.claudeSession.activity || 'Not connected';
    }
    
    // Update session info
    this.sessionProject.textContent = this.claudeSession.currentSession 
      ? this.claudeSession.currentSession.projectName 
      : 'None';
    this.currentActivity.textContent = this.claudeSession.activity;
    this.contextFiles.textContent = this.claudeSession.contextFileCount;
    
    // Update active files list
    this.updateActiveFilesList();
  }
  
  updateActiveFilesList() {
    this.activeFilesList.innerHTML = '';
    
    if (this.claudeSession.activeFiles.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'active-file-item';
      emptyMessage.style.opacity = '0.6';
      emptyMessage.style.fontStyle = 'italic';
      emptyMessage.innerHTML = `
        <span class="active-file-icon">💭</span>
        <span class="active-file-path">No files in context</span>
      `;
      this.activeFilesList.appendChild(emptyMessage);
      return;
    }
    
    this.claudeSession.activeFiles.forEach(file => {
      const item = document.createElement('div');
      item.className = `active-file-item ${file.isCurrentlyEditing ? 'currently-editing' : ''}`;
      item.innerHTML = `
        <span class="active-file-icon">${this.getIcon({ name: file.name, isDirectory: false })}</span>
        <span class="active-file-path">${file.path}</span>
        <span class="active-file-status">${file.status}</span>
      `;
      
      // Add click handler to navigate to file
      item.addEventListener('click', () => {
        this.highlightFileInTree(file.path);
      });
      
      this.activeFilesList.appendChild(item);
    });
  }
  
  updateSessionDropdown() {
    this.sessionDropdown.innerHTML = '';
    
    if (this.claudeSession.availableSessions.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No sessions available';
      option.disabled = true;
      this.sessionDropdown.appendChild(option);
      return;
    }
    
    this.claudeSession.availableSessions.forEach(session => {
      const option = document.createElement('option');
      option.value = session.id;
      option.selected = session.isActive;
      
      const timeAgo = this.getTimeAgo(session.startTime);
      option.textContent = `📁 ${session.projectName} - ${timeAgo}`;
      
      this.sessionDropdown.appendChild(option);
    });
  }
  
  getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    
    if (diffMinutes < 1) return 'just started';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  }
  
  highlightFileInTree(filePath) {
    // Find and highlight the file in the tree
    const treeItem = document.querySelector(`[data-path="${filePath}"]`);
    if (treeItem) {
      // Remove previous selections
      document.querySelectorAll('.tree-item.selected').forEach(el => {
        el.classList.remove('selected');
      });
      
      // Add selection to target file
      treeItem.classList.add('selected');
      treeItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
  
  highlightClaudeFiles(files) {
    // Remove previous Claude file highlighting
    document.querySelectorAll('.tree-item.claude-active').forEach(el => {
      el.classList.remove('claude-active', 'claude-editing');
    });
    
    // Add highlighting for files Claude is working with
    files.forEach(file => {
      const treeItem = document.querySelector(`[data-path="${file.path}"]`);
      if (treeItem) {
        treeItem.classList.add('claude-active');
        if (file.isCurrentlyEditing) {
          treeItem.classList.add('claude-editing');
        }
      }
    });
  }
  
  // Public methods for adding files to Claude context
  async addFileToClaudeContext(filePath) {
    try {
      await this.claudeIntegration.addFilesToContext([filePath]);
    } catch (error) {
      console.error('Failed to add file to Claude context:', error);
    }
  }
  
  async addSelectedFilesToClaudeContext() {
    try {
      const selectedFiles = this.getSelectedFiles();
      if (selectedFiles.length > 0) {
        await this.claudeIntegration.addFilesToContext(selectedFiles);
      }
    } catch (error) {
      console.error('Failed to add selected files to Claude context:', error);
    }
  }
  
  getSelectedFiles() {
    const selectedElements = document.querySelectorAll('.tree-item.selected');
    return Array.from(selectedElements).map(el => el.dataset.path).filter(Boolean);
  }

  cleanup() {
    // Clean up watchers when the app closes
    this.watchers.forEach(watcher => watcher.close());
    this.watchers.clear();
    
    // Clean up Claude integration
    if (this.claudeIntegration) {
      this.claudeIntegration.disconnect();
    }
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