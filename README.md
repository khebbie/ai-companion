# AI Companion

A lightweight Electron file explorer with comprehensive git integration, inspired by VS Code's file tree. Designed to run alongside CLI development workflows for enhanced productivity.

## Features

### 🗂️ File Management
- **VS Code-style dark theme** file tree interface
- **Breadcrumb navigation** with clickable path segments showing actual username
- **Right-click context menu** for file operations (rename, delete, new file/folder, reveal in file manager)
- **Auto-refresh** with file system watchers for real-time updates

### 🎯 Git Integration
- **Real-time git status indicators** (M, A, D, U, ?) with color-coded badges
- **File color coding** based on git status:
  - 🟢 Green: Added files
  - 🟠 Orange: Modified files  
  - 🔴 Red: Deleted files
  - 🔵 Blue: Untracked files
  - 🟣 Purple: Unmerged files
- **Git ignored files** appear dimmed and italicized
- **Current branch display** in header with lightning bolt icon
- **Automatic updates** on commits, staging, and file changes

### 💻 Developer Experience
- **Hot reload** during development
- **Window position persistence** - remembers last position and size
- **No application menu bar** for minimal interface
- **Keyboard shortcuts** and intuitive navigation
- **File watchers** for expanded folders with automatic git status refresh

## Installation

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Setup
```bash
# Clone the repository
git clone <repository-url>
cd ai-companion

# Install dependencies
npm install

# Start the application
npm start

# For development with hot reload
npm run dev
```

## Usage

### Basic Commands
```bash
# Start normally
npm start

# Start with sandbox disabled (if needed)
npm start -- --no-sandbox

# Start with permission bypass for restricted files
npm start -- --dangerously-skip-permissions --no-sandbox

# Development mode with hot reload
npm run dev
```

### Features Guide

#### File Operations
- **Single-click**: Select file/folder
- **Double-click**: Open file with system default application, expand/collapse folders
- **Right-click**: Access context menu for rename, delete, create operations
- **Breadcrumb**: Click any path segment to navigate directly

#### Git Integration
- Git status automatically detected when in a git repository
- File status indicators appear on the right side of file names
- Branch name displayed in header when in git repository
- Status updates in real-time as you work with git commands

#### Permission Handling
Use the `--dangerously-skip-permissions` flag to view files even when permission is denied:
```bash
npm start -- --dangerously-skip-permissions --no-sandbox
```

## Configuration

Window state is automatically saved to `~/.file-explorer-window-state.json` and restored on startup.

## Development

### Project Structure
```
ai-companion/
├── main.js          # Electron main process
├── renderer.js      # File explorer logic + hot reload
├── index.html       # Main UI structure
├── styles.css       # VS Code-inspired styling
├── package.json     # Dependencies and scripts
└── CLAUDE.md        # Project memory and implementation details
```

### Key Dependencies
- **Electron**: Desktop application framework
- **nodemon**: Development hot reload
- **electron-reload**: Automatic reload on file changes

### Technical Features
- Node.js fs module for file operations
- File watchers with debounced refresh (100ms for files, 200ms for git)
- Git command execution via child_process.execSync
- Gitignore pattern matching for ignored file detection
- Real-time .git directory monitoring for status updates

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

ISC License - see package.json for details.

## Acknowledgments

- Inspired by VS Code's file explorer interface
- Built with Electron for cross-platform compatibility
- Designed for developers who want a lightweight file browser alongside their CLI workflow