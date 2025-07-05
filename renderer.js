const fs = require('fs');
const path = require('path');
const { shell } = require('electron');

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
    this.watchers = new Map();
    this.selectedItem = null;
    
    this.init();
  }

  init() {
    this.refreshBtn.addEventListener('click', () => this.refresh());
    this.updateBreadcrumb();
    this.loadFileTree();
    this.setupFileWatcher();
    this.setupContextMenu();
  }

  refresh() {
    this.fileTree.innerHTML = '';
    this.updateBreadcrumb();
    this.loadFileTree();
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
        const stats = fs.statSync(fullPath);
        
        result.push({
          name: item,
          path: fullPath,
          isDirectory: stats.isDirectory(),
          size: stats.size,
          modified: stats.mtime
        });
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
    div.dataset.path = item.path;

    const icon = this.getIcon(item);
    const chevron = item.isDirectory ? 
      `<span class="chevron ${this.expandedFolders.has(item.path) ? 'expanded' : ''}">▶</span>` : 
      '<span class="chevron"></span>';

    div.innerHTML = `
      ${chevron}
      <span class="icon">${icon}</span>
      <span class="name">${item.name}</span>
    `;

    div.addEventListener('click', (e) => this.handleItemClick(e, item));
    div.addEventListener('dblclick', (e) => this.handleItemDoubleClick(e, item));
    div.addEventListener('contextmenu', (e) => this.handleContextMenu(e, item));

    return div;
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
    
    this.breadcrumb.innerHTML = '';
    
    // Add root/home indicator
    const rootPath = path.sep;
    const rootItem = document.createElement('span');
    rootItem.className = 'breadcrumb-item';
    rootItem.textContent = this.currentPath === homeDir ? '~' : '/';
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
      
      // Show home symbol if this is the home directory
      if (cumulativePath === homeDir) {
        item.textContent = '~';
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
            this.refresh();
          }, 100);
        }
      });

      this.watchers.set(dirPath, watcher);
    } catch (error) {
      console.error('Error watching directory:', dirPath, error);
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
          alert(`Error renaming: ${error.message}`);
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
          fs.rmSync(item.path, { recursive: true, force: true });
        } else {
          fs.unlinkSync(item.path);
        }
        // File watcher will handle the refresh
      } catch (error) {
        alert(`Error deleting: ${error.message}`);
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
        alert(`Error creating file: ${error.message}`);
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
        alert(`Error creating folder: ${error.message}`);
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