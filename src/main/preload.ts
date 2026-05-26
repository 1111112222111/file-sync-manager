/**
 * src/main/preload.ts — Electron preload 脚本
 *
 * 通过 contextBridge 将类型安全的 API 暴露给渲染进程。
 */
import { contextBridge, ipcRenderer } from 'electron';

const electronAPI = {
  // —— 同步引擎 ——
  syncUpload: (filePaths: string[]) => ipcRenderer.invoke('sync:upload', filePaths),
  syncDownload: (remotePath: string, localPath: string) => ipcRenderer.invoke('sync:download', remotePath, localPath),
  syncGetTasks: () => ipcRenderer.invoke('sync:getTasks'),
  syncPauseTask: (taskId: string) => ipcRenderer.invoke('sync:pauseTask', taskId),
  syncCancelTask: (taskId: string) => ipcRenderer.invoke('sync:cancelTask', taskId),
  syncRetryTask: (taskId: string) => ipcRenderer.invoke('sync:retryTask', taskId),

  // —— 云端 ——
  cloudListFiles: (remoteDir: string) => ipcRenderer.invoke('cloud:listFiles', remoteDir),
  cloudGetQuota: () => ipcRenderer.invoke('cloud:getQuota'),
  cloudDeleteFile: (remotePath: string) => ipcRenderer.invoke('cloud:deleteFile', remotePath),

  // —— 冲突 ——
  conflictResolve: (taskId: string, choice: 'local' | 'remote' | 'both') => ipcRenderer.invoke('conflict:resolve', taskId, choice),

  // —— 监听源 ——
  watcherGetSources: () => ipcRenderer.invoke('watcher:getSources'),
  watcherAddSource: () => ipcRenderer.invoke('watcher:addSource'),
  watcherRemoveSource: (sourceId: string) => ipcRenderer.invoke('watcher:removeSource', sourceId),
  watcherPauseSource: (sourceId: string) => ipcRenderer.invoke('watcher:pauseSource', sourceId),
  watcherResumeSource: (sourceId: string) => ipcRenderer.invoke('watcher:resumeSource', sourceId),

  // —— 授权 ——
  authGetStatus: () => ipcRenderer.invoke('auth:getStatus'),
  authStartOAuth: () => ipcRenderer.invoke('auth:startOAuth'),
  authLogout: () => ipcRenderer.invoke('auth:logout'),

  // —— 配置 ——
  configGetAll: () => ipcRenderer.invoke('config:getAll'),
  configSet: (key: string, value: any) => ipcRenderer.invoke('config:set', key, value),
  configAddFilterRule: (pattern: string) => ipcRenderer.invoke('config:addFilterRule', pattern),
  configRemoveFilterRule: (ruleId: string) => ipcRenderer.invoke('config:removeFilterRule', ruleId),

  // —— 历史 ——
  historyGetList: (limit?: number, offset?: number) => ipcRenderer.invoke('history:getList', limit, offset),

  // —— 对话框 ——
  dialogSaveFile: (defaultName: string) => ipcRenderer.invoke('dialog:saveFile', defaultName),

  // —— 事件监听 ——
  on: (channel: string, callback: (...args: any[]) => void) => {
    const handler = (_event: any, ...args: any[]) => callback(...args);
    ipcRenderer.on(channel, handler);
    return handler;
  },
  removeListener: (channel: string, handler: (...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, handler);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;
