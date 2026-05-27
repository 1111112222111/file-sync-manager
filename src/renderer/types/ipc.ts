/**
 * src/renderer/types/ipc.ts — IPC 通道类型定义
 *
 * 定义渲染进程通过 contextBridge 可调用的 API 类型。
 * 与主进程 ipc-registry.ts 的类型签名一致。
 */

import type {
  TransferTask, FileInfo, QuotaInfo, WatchSource, WatchStatus,
  AuthStatus, AppConfig, FilterRule, ConflictInfo, ConflictChoice,
  TransferRecord, HistoryQuery, DeleteResult,
} from '../../shared/types';

/** contextBridge 暴露给渲染进程的 API */
export interface ElectronAPI {
  // Sync
  syncUpload(filePaths: string[]): Promise<void>;
  syncDownload(remotePath: string, localPath: string): Promise<void>;
  syncGetTasks(): Promise<TransferTask[]>;
  syncPauseTask(taskId: string): Promise<void>;
  syncCancelTask(taskId: string): Promise<void>;
  syncRetryTask(taskId: string): Promise<void>;

  // Cloud
  cloudListFiles(remoteDir: string): Promise<FileInfo[]>;
  cloudGetQuota(): Promise<QuotaInfo>;
  cloudDeleteFile(remotePath: string): Promise<DeleteResult>;

  // Watcher
  watcherGetSources(): Promise<WatchSource[]>;
  watcherAddSource(localPath: string): Promise<WatchSource>;
  watcherRemoveSource(id: string): Promise<void>;

  // Conflict
  conflictResolve(taskId: string, choice: ConflictChoice): Promise<void>;

  // Auth
  authGetStatus(): Promise<AuthStatus>;
  authStartOAuth(): Promise<void>;
  authLogout(): Promise<void>;

  // Config
  configGetAll(): Promise<AppConfig>;
  configSet(key: string, value: unknown): Promise<void>;
  configAddFilterRule(pattern: string): Promise<FilterRule>;
  configRemoveFilterRule(id: string): Promise<void>;

  // History
  historyGetList(query?: HistoryQuery): Promise<TransferRecord[]>;

  // Event listeners (main → renderer)
  on(channel: string, callback: (...args: unknown[]) => void): void;
  removeListener(channel: string, callback: (...args: unknown[]) => void): void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
