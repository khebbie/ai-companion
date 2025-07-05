# File Explorer - Project Memory

## Project Overview
Lightweight Electron file explorer app inspired by VS Code's file tree, designed to run alongside CLI development work.

## Key Features
- VS Code-style dark theme file tree
- Breadcrumb navigation with clickable path segments
- Right-click context menu (rename, delete, new file/folder, reveal in file manager)
- Auto-refresh with file system watchers
- Hot reload for development
- No application menu bar (File, Edit, View, etc.)

## Development Commands
```bash
# Start with hot reload (recommended for development)
npm run dev

# Start normally
npm start -- --no-sandbox

# Install dependencies
npm install
```

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

## Technical Notes
- Uses Node.js fs module for file operations
- File watchers auto-refresh on changes (debounced 100ms)
- Context menu handles rename, delete, create operations
- Breadcrumb shows current path with home (~) shortcut
- Hot reload via electron-reload + nodemon
- No sandbox mode required for file system access

## Important Implementation Details
- `mainWindow.setMenuBarVisibility(false)` hides application menu
- Context menu positioning adjusts for screen boundaries
- File rename uses inline input with Enter/Escape handling
- File watchers track expanded folders automatically
- Double-click opens files with system default app

## User Preferences
- Wants minimal interface without application menu bar
- Needs right-click context menu for file operations
- Prefers auto-refresh during development
- Uses alongside CLI tools for coding