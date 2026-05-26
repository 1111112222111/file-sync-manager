/**
 * src/main/index.ts — Electron 主进程入口
 *
 * 负责：窗口创建、应用生命周期管理
 */

import { app, BrowserWindow, Tray } from 'electron';
import * as path from 'path';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 680,
    minWidth: 760,
    minHeight: 500,
    title: '文件自动同步管理器',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    // 默认使用深色主题的标题栏（Windows）
    backgroundColor: '#1a1a2e',
    show: false,
  });

  // 开发环境加载 Vite dev server，生产环境加载打包文件
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // 窗口准备好后再显示，避免白屏闪烁
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // 关闭窗口时最小化到托盘而非退出
  mainWindow.on('close', (event) => {
    if (process.platform !== 'darwin' && mainWindow && !isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      // 显示"已最小化到系统托盘"提示（由 TrayManager 处理）
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 应用初始化
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

// 所有窗口关闭时退出（macOS 除外）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 标记应用正在退出（用于区分关闭窗口和退出应用）
app.on('before-quit', () => {
  isQuitting = true;
});
