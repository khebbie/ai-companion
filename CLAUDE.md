# AI Companion - Project Memory

## Project Overview
AI Companion is a lightweight Electron file explorer app inspired by VS Code's file tree, designed to run alongside CLI development work.

## Key Features
- VS Code-style dark theme file tree
- Breadcrumb navigation with clickable path segments showing actual username (reduced spacing)
- Right-click context menu (rename, delete, new file/folder, reveal in file manager)
- Auto-refresh with file system watchers for real-time updates
- Hot reload for development
- No application menu bar for minimal interface
- Window position persistence across sessions
- Permission handling with `--dangerously-skip-permissions` flag
- Global installation support as command-line tool

## Installation & Usage
```bash
# Global installation (recommended)
npm install -g .
ai-companion /path/to/project

# Local development
npm start /path/to/project -- --no-sandbox
npm run dev

# With permission bypass
ai-companion /restricted/path --dangerously-skip-permissions
```

## Command Line Interface
- **Directory parameter**: First non-flag argument sets working directory
- **--dangerously-skip-permissions**: Bypass file permission errors
- **--no-sandbox**: Disable Electron sandbox (may be needed on some systems)
- **Executable**: main.js has shebang and executable permissions

## Project Structure
```
/home/khebbie/Documents/src/typescript/explore/
├── main.js          # Electron main process
├── renderer.js      # File explorer logic + hot reload
├── index.html       # Main UI structure
├── styles.css       # VS Code-inspired styling
├── package.json     # Dependencies: electron, nodemon, electron-reload
└── .gitignore       # Excludes node_modules, logs, etc.
```

## Git Integration
- **Real-time git status indicators** (M, A, D, U, ?) with color-coded badges
- **File color coding**: green (added), orange (modified), red (deleted), blue (untracked), purple (unmerged)
- **Git ignored files** appear dimmed and italicized
- **Current branch display** in header with lightning bolt icon
- **Automatic updates** on commits, staging, and file changes via git directory watcher
- **Gitignore pattern matching** for identifying ignored files

## Technical Notes
- Uses Node.js fs module for file operations
- File watchers auto-refresh on changes (debounced 100ms for files, 200ms for git)
- Context menu handles rename, delete, create operations
- Breadcrumb shows actual username instead of tilde (~)
- Hot reload via electron-reload + nodemon
- Git command execution via child_process.execSync
- Real-time .git directory monitoring for status updates

## Important Implementation Details
- `mainWindow.setMenuBarVisibility(false)` hides application menu
- Context menu positioning adjusts for screen boundaries
- Context menu closes on click outside or Escape key
- File rename uses inline input with Enter/Escape handling
- File watchers track expanded folders automatically
- **Double-click behavior**:
  - Files: Open with system default application
  - Folders: Change application working directory (uses `process.chdir()`)
  - Breadcrumb: Change application working directory
- **Window state persistence** via `~/.file-explorer-window-state.json`
- **Permission handling** with visual indicators (lock icons, dimmed styling)

## User Preferences & Evolution
- Originally named "explore", rebranded to "AI Companion"
- Wants minimal interface without application menu bar
- Needs right-click context menu for file operations
- Prefers auto-refresh during development
- Uses alongside CLI tools for coding
- Requested breadcrumb spacing improvements (implemented)
- Requested git integration with status indicators (implemented)
- Requested working directory parameter support (implemented)
- Wants global installation as normal program (implemented)