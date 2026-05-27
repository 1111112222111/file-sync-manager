/**
 * src/main/index.ts — Electron 主进程入口
 */
import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

// —— 导入所有模块 ——
import { registerIPCHandlers } from './ipc-registry';
import { SyncEngine } from './sync/sync-engine';
import { TransferQueue } from './sync/transfer-queue';
import { ConflictDetector } from './sync/conflict-detector';
import { FileWatcher } from './sync/file-watcher';
import { FilterManager } from './config/filter-manager';
import { ConfigStore } from './config/config-store';
import { AuthManager } from './auth/auth-manager';
import { HistoryStore } from './db/history-store';
import { NotificationManager } from './notification/notification-manager';
import { BaiduPanAdapter } from './cloud/baidu-pan.adapter';
import { TrayManager } from './tray/tray-manager';

let mainWindow: BrowserWindow | null = null;
let trayManager: TrayManager | null = null;
let isQuitting = false;

function loadEnv(): void {
  const envPath = path.resolve(app.getAppPath(), '.env');
  if (fs.existsSync(envPath)) { parseEnvFile(envPath); return; }
  const altPath = path.resolve(path.dirname(app.getAppPath()), '.env');
  if (fs.existsSync(altPath)) parseEnvFile(altPath);
}

function parseEnvFile(filePath: string): void {
  const content = fs.readFileSync(filePath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

function createWindow(): void {
  const preloadPath = path.join(__dirname, 'preload.js');

  mainWindow = new BrowserWindow({
    width: 420, height: 560,
    minWidth: 340, minHeight: 400,
    title: '文件自动同步管理器',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: preloadPath,
    },
    backgroundColor: '#1a1a2e',
    show: false,
    frame: false,
    resizable: true,
  });

  const isDev = process.argv.includes('--dev');
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  const iconPath = path.join(__dirname, '../../assets/icon.png');
  if (fs.existsSync(iconPath)) {
    mainWindow.setIcon(iconPath);
  }

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  mainWindow.on('close', (event) => {
    if (process.platform !== 'darwin' && mainWindow && !isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

function setupIPC(): void {
  try {
    const configStore = new ConfigStore();
    const credentials = {
      appId: process.env.BAIDU_APP_ID ?? '',
      apiKey: process.env.BAIDU_API_KEY ?? '',
      secretKey: process.env.BAIDU_SECRET_KEY ?? '',
    };
    if (credentials.apiKey) configStore.set('baiduCredentials', credentials);

    const authManager = new AuthManager();
    if (credentials.apiKey) authManager.setCredentials(credentials);
    const token = configStore.getAll().baiduToken;
    if (token) authManager.setToken(token);

    const adapter = new BaiduPanAdapter({
      accessToken: authManager.getToken()?.accessToken ?? '',
      remoteRoot: configStore.getAll().remoteRootPath,
    });

    const queue = new TransferQueue(adapter);
    const conflictDetector = new ConflictDetector(adapter);
    const filterManager = new FilterManager();
    const fileWatcher = new FileWatcher();
    const historyStore = new HistoryStore();
    const notificationManager = new NotificationManager();

    const syncEngine = new SyncEngine(
      adapter, queue, conflictDetector, filterManager,
      configStore.getAll().remoteRootPath,
    );
    syncEngine.setFileWatcher(fileWatcher);

    registerIPCHandlers({
      syncEngine, transferQueue: queue, cloudAdapter: adapter,
      fileWatcher, authManager, configStore, historyStore, notificationManager,
    }, mainWindow!);

    // 初始化托盘
    trayManager = new TrayManager();
    trayManager.init(mainWindow!);

    console.log('[IPC] All handlers registered');
  } catch (err: any) {
    console.error('[IPC] Registration failed:', err.message, err.stack);
  }
}

app.whenReady().then(() => {
  loadEnv();
  createWindow();
  setupIPC();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      setupIPC();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  isQuitting = true;
  trayManager?.destroy();
});
