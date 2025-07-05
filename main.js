const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Parse command line arguments
const args = process.argv.slice(2);
const skipPermissions = args.includes('--dangerously-skip-permissions');

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
      additionalArguments: skipPermissions ? ['--skip-permissions'] : []
    },
    resizable: true,
    title: 'File Explorer'
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