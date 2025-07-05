# AI Companion Test Suite

This test suite provides comprehensive behavior testing for the AI Companion file explorer application using Playwright for Electron.

## Test Philosophy

- **Behavior over Implementation**: Tests focus on user-visible behavior rather than internal implementation details
- **Integration Testing**: Tests the app as a complete system rather than isolated units
- **Real Environment**: Uses temporary directories with actual files and git repositories
- **Cross-platform Compatibility**: Designed to work across different operating systems

## Test Structure

### Core Test Files

- **`file-tree.spec.js`** - File tree display, navigation, and auto-refresh
- **`context-menu.spec.js`** - Right-click operations (rename, delete, create)
- **`git-integration.spec.js`** - Git status indicators and branch display
- **`breadcrumb-navigation.spec.js`** - Path navigation and working directory changes
- **`command-line-args.spec.js`** - Command line parameters and permission handling
- **`app-lifecycle.spec.js`** - Application startup, window management, and performance

### Helper Classes

- **`helpers/electron-app.js`** - Test harness for launching and managing Electron app instances

## Key Testing Behaviors

### File Management
- ✅ File tree displays correctly with proper structure
- ✅ Folders expand/collapse on click
- ✅ Files open with double-click
- ✅ Auto-refresh on file system changes
- ✅ File ordering (directories first)

### Context Menu Operations
- ✅ Menu appears on right-click
- ✅ Create new files and folders
- ✅ Rename files with inline editing
- ✅ Delete files and folders
- ✅ Menu dismissal (click outside, Escape key)
- ✅ "Reveal in File Manager" option

### Git Integration
- ✅ Branch display with lightning bolt icon
- ✅ File status indicators (M, A, D, U, ?)
- ✅ Color-coded status (green=added, orange=modified, etc.)
- ✅ Git ignored files appear dimmed/italic
- ✅ Real-time status updates
- ✅ Graceful handling of non-git directories

### Navigation
- ✅ Breadcrumb shows actual username (not ~)
- ✅ Clickable breadcrumb segments
- ✅ Working directory changes via double-click
- ✅ Reduced spacing in breadcrumb
- ✅ Parent directory navigation

### Command Line Interface
- ✅ Directory parameter sets working directory
- ✅ `--dangerously-skip-permissions` flag handling
- ✅ Multiple flag support
- ✅ Invalid directory handling
- ✅ Permission error indicators

### Application Lifecycle
- ✅ Successful startup and window display
- ✅ No application menu bar
- ✅ Responsive window resizing
- ✅ Graceful shutdown
- ✅ Performance with large file trees

## Running Tests

```bash
# Install dependencies
npm install

# Run all tests (headless)
npm test

# Run tests with visible browser (for debugging)
npm run test:headed

# Run tests in debug mode
npm run test:debug

# Run specific test file
npx playwright test file-tree.spec.js

# Run tests matching a pattern
npx playwright test --grep "context menu"
```

## Test Environment

Each test creates a temporary directory with:
- Sample files (README.md, package.json, etc.)
- Directory structure (src/, tests/, docs/)
- Git repository (when testing git features)
- Proper cleanup after test completion

## Best Practices Implemented

1. **Isolated Test Environment**: Each test uses a fresh temporary directory
2. **Proper Cleanup**: All temporary files and directories are removed after tests
3. **Realistic Test Data**: Uses actual files and git repositories, not mocks
4. **Timeout Handling**: Appropriate waits for async operations
5. **Error Tolerance**: Tests handle missing dependencies (like git) gracefully
6. **Platform Independence**: Tests work across different operating systems

## Debugging Tests

- Use `npm run test:headed` to see the Electron app during testing
- Use `npm run test:debug` to step through tests interactively
- Screenshots and videos are captured on test failures
- Console logs from the Electron app are available in test output

## Extending Tests

When adding new features to AI Companion:

1. Add behavior tests to the appropriate spec file
2. Focus on user-visible behavior, not implementation
3. Use the `ElectronApp` helper for consistent test setup
4. Ensure tests clean up properly
5. Make tests resilient to timing and environment differences

## Test Coverage

The test suite covers all major user interactions and features:
- ✅ File system operations
- ✅ Git integration features  
- ✅ Navigation and breadcrumbs
- ✅ Context menu functionality
- ✅ Command line interface
- ✅ Application lifecycle
- ✅ Performance and reliability
- ✅ Error handling and edge cases