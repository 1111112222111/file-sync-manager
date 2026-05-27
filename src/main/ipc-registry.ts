/**
 * src/main/ipc-registry.ts — IPC 通道注册与 contextBridge 配置
 *
 * 所有渲染进程 ↔ 主进程的通信通道在此注册。
 * preload.ts 通过 contextBridge 将 API 暴露给渲染进程。
 */
import { ipcMain, dialog, BrowserWindow } from 'electron';
import type { SyncEngine } from './sync/sync-engine';
import type { TransferQueue } from './sync/transfer-queue';
import type { CloudAdapter } from './cloud/adapter.interface';
import type { FileWatcher } from './sync/file-watcher';
import type { AuthManager } from './auth/auth-manager';
import type { ConfigStore } from './config/config-store';
import type { HistoryStore } from './db/history-store';
import type { NotificationManager } from './notification/notification-manager';

interface IPCRegistryDeps {
  syncEngine: SyncEngine;
  transferQueue: TransferQueue;
  cloudAdapter: CloudAdapter;
  fileWatcher: FileWatcher;
  authManager: AuthManager;
  configStore: ConfigStore;
  historyStore: HistoryStore;
  notificationManager: NotificationManager;
}

export function registerIPCHandlers(deps: IPCRegistryDeps, mainWindow: BrowserWindow): void {
  const { syncEngine, transferQueue, cloudAdapter, fileWatcher, authManager, configStore, historyStore, notificationManager } = deps;

  // —— 同步引擎 ——
  ipcMain.handle('sync:upload', async (_event, filePaths: string[]) => {
    await syncEngine.handleDropUpload(filePaths);
  });

  ipcMain.handle('sync:download', async (_event, remotePath: string, localPath: string) => {
    await syncEngine.handleDownload(remotePath, localPath);
  });

  ipcMain.handle('sync:getTasks', () => {
    return transferQueue.getAllTasks();
  });

  ipcMain.handle('sync:pauseTask', (_event, taskId: string) => {
    transferQueue.pauseTask(taskId);
  });

  ipcMain.handle('sync:cancelTask', (_event, taskId: string) => {
    transferQueue.cancelTask(taskId);
  });

  ipcMain.handle('sync:retryTask', (_event, taskId: string) => {
    transferQueue.retryTask(taskId);
  });

  // —— 传输进度推送到渲染进程 ——
  transferQueue.onProgress = (task) => {
    mainWindow.webContents.send('transfer:progress', task);
  };
  transferQueue.onCompleted = (task) => {
    mainWindow.webContents.send('transfer:completed', task);
  };
  transferQueue.onFailed = (task) => {
    mainWindow.webContents.send('transfer:failed', task);
  };

  // —— 冲突回调 ——
  syncEngine.onConflict = (conflict) => {
    mainWindow.webContents.send('conflict:detected', conflict);
  };

  // —— 云端浏览 ——
  ipcMain.handle('cloud:listFiles', async (_event, remoteDir: string) => {
    return await cloudAdapter.listFiles(remoteDir);
  });

  ipcMain.handle('cloud:getQuota', async () => {
    return await cloudAdapter.getQuota();
  });

  ipcMain.handle('cloud:deleteFile', async (_event, remotePath: string) => {
    return await cloudAdapter.deleteFile(remotePath);
  });

  // —— 冲突处理 ——
  ipcMain.handle('conflict:resolve', async (_event, taskId: string, choice: 'local' | 'remote' | 'both') => {
    // 此处需根据 choice 执行对应操作
    // 'remote': 跳过上传
    // 'both': 重命名云端 + 上传
    // 'local': 继续上传
  });

  // —— 文件监听 ——
  ipcMain.handle('watcher:getSources', () => {
    return fileWatcher.getSources();
  });

  ipcMain.handle('watcher:addSource', async (_event) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: '选择要监听的文件夹',
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return await fileWatcher.addSource(result.filePaths[0]);
  });

  ipcMain.handle('watcher:removeSource', async (_event, sourceId: string) => {
    await fileWatcher.removeSource(sourceId);
  });

  ipcMain.handle('watcher:pauseSource', (_event, sourceId: string) => {
    fileWatcher.pauseSource(sourceId);
  });

  ipcMain.handle('watcher:resumeSource', (_event, sourceId: string) => {
    fileWatcher.resumeSource(sourceId);
  });

  // —— 授权 ——
  ipcMain.handle('auth:getStatus', () => {
    return authManager.getStatus();
  });

  ipcMain.handle('auth:startOAuth', async () => {
    const result = await authManager.startOAuth();
    if (result.success) {
      const token = authManager.getToken();
      if (token) {
        configStore.set('baiduToken', token);
        cloudAdapter.setAccessToken(token.accessToken);
      }
    }
    return result;
  });

  ipcMain.handle('auth:logout', () => {
    authManager.logout();
    configStore.set('baiduToken', null);
  });

  // —— 配置 ——
  ipcMain.handle('config:getAll', () => {
    return configStore.getAll();
  });

  ipcMain.handle('config:set', (_event, key: string, value: any) => {
    configStore.set(key, value);
  });

  ipcMain.handle('config:addFilterRule', (_event, pattern: string) => {
    configStore.addFilterRule(pattern);
  });

  ipcMain.handle('config:removeFilterRule', (_event, ruleId: string) => {
    configStore.removeFilterRule(ruleId);
  });

  // —— 历史记录 ——
  ipcMain.handle('history:getList', (_event, limit?: number, offset?: number) => {
    return historyStore.getList(limit, offset);
  });

  // —— 窗口控制 ——
  ipcMain.handle('window:minimize', () => {
    mainWindow.minimize();
  });

  ipcMain.handle('window:close', () => {
    mainWindow.close();
  });

  // —— 系统对话框 ——
  ipcMain.handle('dialog:saveFile', async (_event, defaultName: string) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultName,
      title: '选择下载保存路径',
    });
    return result.canceled ? null : result.filePath;
  });

  // —— 文件监听变更回调 ——
  fileWatcher.onFileChanged = (localPath, sourceId) => {
    syncEngine.handleFileChange(localPath, sourceId);
  };
}
