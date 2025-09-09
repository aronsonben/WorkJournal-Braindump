/* eslint-disable @typescript-eslint/no-require-imports */
require('dotenv').config();

const { app, BrowserWindow, Tray, Menu, globalShortcut, screen, ipcMain } = require('electron');
const path = require('path');
const { validateConfig } = require('./config');

// Validate configuration
if (!validateConfig()) {
  console.log('⚠️  Configuration incomplete. Please update your Supabase credentials in .env file.');
} else {
  console.log('✅ Configuration loaded successfully');
}

let mainWindow;
let tray;
let isExpanded = false;

// Constants
const WIDGET_SIZE = 60;
const EXPANDED_WIDTH = 400;
const EXPANDED_HEIGHT = 300;

function createWindow() {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;
  
  mainWindow = new BrowserWindow({
    width: WIDGET_SIZE,
    height: WIDGET_SIZE,
    x: width - WIDGET_SIZE - 20,
    y: height - WIDGET_SIZE - 20,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false, // We'll handle dragging ourselves
    hasShadow: false, // Important for transparency
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.setMenuBarVisibility(false);
  
  // Dev tools
  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // Prevent closing, just hide
  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // Collapse when clicking outside
  mainWindow.on('blur', () => {
  if (isExpanded) {
      collapseWidget();
    }
  });
}

function createTray() {
  try {
    const trayIconPath = path.join(__dirname, 'assets', 'suitcase.png');
    tray = new Tray(trayIconPath);
    
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Show Widget', click: () => mainWindow.show() },
      { label: 'Quit', click: () => { app.isQuiting = true; app.quit(); }}
    ]);
    
    tray.setToolTip('WorkJournal Widget');
    tray.setContextMenu(contextMenu);
    tray.on('click', () => mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show());
  } catch (err) {
    console.log('Tray creation failed:', err.message);
  }
}

function expandWidget() {
  console.log('[WJ] expandWidget called');
  const display = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = display.workAreaSize;
  const { x, y, width, height } = mainWindow.getBounds();
  
  // Calculate new position to keep bottom-right corner anchored
  let newX = x + width - EXPANDED_WIDTH;
  let newY = y + height - EXPANDED_HEIGHT;
  
  // Keep within screen bounds
  newX = Math.max(0, Math.min(newX, screenWidth - EXPANDED_WIDTH));
  newY = Math.max(0, Math.min(newY, screenHeight - EXPANDED_HEIGHT));
  
  mainWindow.setBounds({ x: newX, y: newY, width: EXPANDED_WIDTH, height: EXPANDED_HEIGHT });
  mainWindow.webContents.send('set-expanded', true);
  isExpanded = true;
}

function collapseWidget() {
  console.log('[WJ] collapseWidget called');
  const { x, y, width, height } = mainWindow.getBounds();
  
  // Keep bottom-right corner anchored
  const newX = x + width - WIDGET_SIZE;
  const newY = y + height - WIDGET_SIZE;
  
  mainWindow.setBounds({ x: newX, y: newY, width: WIDGET_SIZE, height: WIDGET_SIZE });
  mainWindow.webContents.send('set-expanded', false);
  isExpanded = false;
}

// App events
app.whenReady().then(() => {
  createWindow();
  createTray();
  
  // Global shortcut
  globalShortcut.register('CommandOrControl+Shift+W', () => {
    if (mainWindow.isVisible()) {
      const { width } = mainWindow.getBounds();
      if (width === WIDGET_SIZE) {
        expandWidget();
      } else {
        collapseWidget();
      }
    } else {
      mainWindow.show();
      expandWidget();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// IPC handlers
ipcMain.on('toggle-expand', () => {
  console.log('[WJ] ipcMain toggle-expand');
  if (!isExpanded) {
    expandWidget();
  } else {
    collapseWidget();
  }
});

ipcMain.on('collapse', () => {
  console.log('[WJ] ipcMain collapse');
  collapseWidget();
});

ipcMain.on('entry-saved', () => {
  console.log('[WJ] ipcMain entry-saved');
  setTimeout(() => collapseWidget(), 1000);
});

// Dragging
let dragOffset = null;

ipcMain.on('start-drag', (event, { x, y }) => {
  console.log('[WJ] ipcMain start-drag');
  dragOffset = { x: x, y: y };
});

ipcMain.on('drag', (event, { screenX, screenY }) => {
  if (!dragOffset) return;
  mainWindow.setPosition(screenX - dragOffset.x, screenY - dragOffset.y);
});

ipcMain.on('end-drag', () => {
  console.log('[WJ] ipcMain end-drag');
  dragOffset = null;
});

// DevTools opener from renderer
ipcMain.on('open-devtools', () => {
  try {
    console.log('[WJ] ipcMain open-devtools');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } catch (e) {
    console.log('openDevTools failed:', e.message);
  }
});

// Hide dock icon on macOS
if (process.platform === 'darwin' && app.dock) {
  app.dock.hide();
}