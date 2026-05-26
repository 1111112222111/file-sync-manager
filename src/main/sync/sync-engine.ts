/**
 * src/main/sync/sync-engine.ts — 同步协调中心
 *
 * 职责：接收上传/下载请求，协调冲突检测、过滤检查，调度传输队列。
 */
import * as fs from 'fs';
import * as path from 'path';
import type { ICloudAdapter } from '../cloud/adapter.interface';
import type { TransferQueue } from './transfer-queue';
import type { ConflictDetector } from './conflict-detector';
import type { FilterManager } from '../config/filter-manager';
import type { FileWatcher } from './file-watcher';
import type { ConflictInfo, SyncStatus } from '../../shared/types';

export class SyncEngine {
  private adapter: ICloudAdapter;
  private queue: TransferQueue;
  private conflictDetector: ConflictDetector;
  private filterManager: FilterManager;
  private fileWatcher?: FileWatcher;
  private remoteRootPath: string;
  private completedTodayCount = 0;

  /** 冲突回调（由 IPC 层注册，转发到渲染进程） */
  onConflict?: (conflict: ConflictInfo) => void;

  constructor(
    adapter: ICloudAdapter,
    queue: TransferQueue,
    conflictDetector: ConflictDetector,
    filterManager: FilterManager,
    remoteRootPath = '/我的同步文件',
  ) {
    this.adapter = adapter;
    this.queue = queue;
    this.conflictDetector = conflictDetector;
    this.filterManager = filterManager;
    this.remoteRootPath = remoteRootPath;

    this.queue.onCompleted = () => {
      this.completedTodayCount++;
    };
  }

  /** 注入 FileWatcher（用于查找监听源的 remoteDir） */
  setFileWatcher(watcher: FileWatcher): void {
    this.fileWatcher = watcher;
  }

  /** 更新云端根目录路径 */
  setRemoteRootPath(remoteRootPath: string): void {
    this.remoteRootPath = remoteRootPath;
  }

  /** 拼接远程路径 */
  private buildRemotePath(localPath: string, watchSourceId?: string): string {
    const fileName = path.basename(localPath);

    if (watchSourceId && this.fileWatcher) {
      const sources = this.fileWatcher.getSources();
      const source = sources.find(s => s.id === watchSourceId);
      if (source?.remoteDir) {
        return `${source.remoteDir.replace(/\/$/, '')}/${fileName}`;
      }
    }

    return `${this.remoteRootPath.replace(/\/$/, '')}/${fileName}`;
  }

  /** 处理拖拽触发的上传 */
  async handleDropUpload(filePaths: string[]): Promise<void> {
    for (const localPath of filePaths) {
      if (!fs.existsSync(localPath)) continue;

      const stat = fs.statSync(localPath);
      const remotePath = this.buildRemotePath(localPath);

      const conflict = await this.conflictDetector.checkConflict(localPath, remotePath);
      if (conflict) {
        conflict.taskId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        this.onConflict?.(conflict);
        continue;
      }

      this.queue.addTask({
        localPath,
        remotePath,
        direction: 'upload',
        fileSize: stat.size,
      });
    }
  }

  /** 处理文件变更触发的上传 */
  async handleFileChange(localPath: string, watchSourceId: string): Promise<void> {
    if (this.filterManager.shouldExclude(localPath)) return;
    if (!fs.existsSync(localPath)) return;

    const stat = fs.statSync(localPath);
    const remotePath = this.buildRemotePath(localPath, watchSourceId);

    const conflict = await this.conflictDetector.checkConflict(localPath, remotePath);
    if (conflict) {
      conflict.taskId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      this.onConflict?.(conflict);
      return;
    }

    this.queue.addTask({
      localPath,
      remotePath,
      direction: 'upload',
      fileSize: stat.size,
    });
  }

  /** 处理下载请求 */
  async handleDownload(remotePath: string, localPath: string): Promise<void> {
    let fileSize = 0;
    try {
      const info = await this.adapter.getFileInfo(remotePath);
      fileSize = info.size;
    } catch {
      fileSize = 0;
    }

    this.queue.addTask({
      localPath,
      remotePath,
      direction: 'download',
      fileSize,
    });
  }

  /** 获取同步状态摘要 */
  getSyncStatus(): SyncStatus {
    const stats = this.queue.getStats();
    return {
      isSyncing: stats.transferring > 0,
      pendingCount: stats.pending,
      completedToday: this.completedTodayCount,
      lastSyncTime: stats.completed > 0 ? Date.now() : null,
    };
  }
}
