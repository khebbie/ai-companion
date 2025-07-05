# AI Companion

A lightweight Electron file explorer with comprehensive git integration, inspired by VS Code's file tree. Designed to run alongside CLI development workflows for enhanced productivity.
AI Companion works well with at code flow lige Claude Code.
AI Companion is coded 100% by Claude Code.

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

### Method 1: Global Installation (Recommended)
```bash
# Clone the repository
git clone <repository-url>
cd ai-companion

# Install dependencies
npm install

# Install globally for system-wide access
npm install -g .

# Now you can run from anywhere
ai-companion
ai-companion /path/to/your/project
ai-companion ~/Documents/code
```

### Method 2: Local Development Setup
```bash
# Clone the repository
git clone <repository-url>
cd ai-companion

# Install dependencies
npm install

# Start the application (current directory)
npm start

# Start with specific directory
npm start /path/to/project

# For development with hot reload
npm run dev
```

### Method 3: Direct Execution
```bash
# After installing dependencies
chmod +x main.js

# Run directly with electron (if globally installed)
./main.js /path/to/project
```

## Usage

### Global Installation Usage (Recommended)
```bash
# Start in current directory
ai-companion

# Start in specific directory
ai-companion /path/to/project
ai-companion ~/Documents/code
ai-companion .

# Start with permission bypass for restricted files
ai-companion /path/to/project --dangerously-skip-permissions

# Start with specific flags
ai-companion ~/project --no-sandbox --dangerously-skip-permissions
```

### Local Development Usage
```bash
# Start in current directory
npm start

# Start in specific directory
npm start /path/to/project

# Start with sandbox disabled (if needed)
npm start /path/to/project -- --no-sandbox

# Start with permission bypass for restricted files
npm start /path/to/project -- --dangerously-skip-permissions --no-sandbox

# Development mode with hot reload
npm run dev
```

### Command Line Arguments
- **Directory Path**: First argument specifies the working directory
  - `ai-companion /home/user/project`
  - `ai-companion ~/Documents/code`
  - `ai-companion .` (current directory)
- **--dangerously-skip-permissions**: Bypass file permission errors
- **--no-sandbox**: Disable Electron sandbox (may be needed on some systems)

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

**Global Installation:**
```bash
ai-companion /restricted/path --dangerously-skip-permissions
```

**Local Development:**
```bash
npm start /restricted/path -- --dangerously-skip-permissions --no-sandbox
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
