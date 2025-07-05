#!/usr/bin/env electron
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

// Parse command line arguments
const args = process.argv.slice(2);
const skipPermissions = args.includes('--dangerously-skip-permissions');

// Parse working directory argument (first non-flag argument)
let initialWorkingDirectory = process.cwd();
for (const arg of args) {
  if (!arg.startsWith('--')) {
    // This is a directory path argument
    const resolvedPath = path.resolve(arg);
    try {
      if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory()) {
        initialWorkingDirectory = resolvedPath;
        break;
      } else {
        console.warn(`Warning: Directory "${arg}" does not exist or is not a directory. Using current directory.`);
      }
    } catch (error) {
      console.warn(`Warning: Cannot access directory "${arg}". Using current directory.`);
    }
  }
}

// Path to store window state
const windowStateFile = path.join(os.homedir(), '.file-explorer-window-state.json');

function loadWindowState() {
  try {
    const data = fs.readFileSync(windowStateFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // Return default state if file doesn't exist or can't be read
    return {
      width: 400,
      height: 800,
      x: undefined,
      y: undefined
    };
  }
}

function saveWindowState(mainWindow) {
  try {
    const bounds = mainWindow.getBounds();
    const state = {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y
    };
    fs.writeFileSync(windowStateFile, JSON.stringify(state, null, 2));
  } catch (error) {
    console.error('Failed to save window state:', error);
  }
}

function createWindow() {
  const windowState = loadWindowState();
  
  const mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      additionalArguments: [
        ...(skipPermissions ? ['--skip-permissions'] : []),
        '--initial-directory', initialWorkingDirectory
      ]
    },
    resizable: true,
    title: 'AI Companion'
  });

  // Hide the menu bar
  mainWindow.setMenuBarVisibility(false);

  // Save window state when it's moved or resized
  mainWindow.on('moved', () => saveWindowState(mainWindow));
  mainWindow.on('resized', () => saveWindowState(mainWindow));
  
  // Save window state before closing
  mainWindow.on('close', () => saveWindowState(mainWindow));

  mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handler for opening new AI Companion instances
ipcMain.handle('open-new-ai-companion', async (event, targetDirectory) => {
  try {
    console.log(`Opening new AI Companion in: ${targetDirectory}`);
    
    // Try to use the ai-companion command first (should work now with our wrapper)
    const child = spawn('ai-companion', [targetDirectory], {
      detached: true,
      stdio: 'ignore'
    });
    
    // Detach the child process so it runs independently
    child.unref();
    
    return { success: true, message: `Opened new AI Companion in: ${targetDirectory}` };
  } catch (error) {
    console.error('Error with ai-companion command:', error);
    
    // Fallback: try with electron directly using the current process path
    try {
      const electronPath = process.execPath;
      const child = spawn(electronPath, ['--no-sandbox', __dirname, targetDirectory], {
        detached: true,
        stdio: 'ignore'
      });
      
      child.unref();
      
      return { success: true, message: `Opened new AI Companion (via electron) in: ${targetDirectory}` };
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError);
      return { success: false, message: `Failed to open new AI Companion: ${error.message}` };
    }
  }
});