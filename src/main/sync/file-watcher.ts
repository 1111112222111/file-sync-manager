/**
 * src/main/sync/file-watcher.ts — chokidar 文件监听封装
 *
 * 职责：管理监听源，防抖 300ms 聚合变更事件，触发回调。
 */
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import type { WatchSource, WatchStatus } from '../../shared/types';

export type FileChangeCallback = (localPath: string, watchSourceId: string) => void;

type ChokidarWatcher = {
  close(): Promise<void>;
  on(event: string, handler: (p: string) => void): void;
};

type ChokidarWatchFn = (targetPath: string, options?: any) => ChokidarWatcher;

export class FileWatcher {
  private sources: Map<string, WatchSource> = new Map();
  private watchers: Map<string, ChokidarWatcher> = new Map();
  private changeTimers: Map<string, NodeJS.Timeout> = new Map();
  private chokidarWatch?: ChokidarWatchFn;
  private debounceMs = 300;

  onFileChanged?: FileChangeCallback;

  constructor(chokidarWatch?: ChokidarWatchFn) {
    this.chokidarWatch = chokidarWatch;
  }

  private getChokidarWatch(): ChokidarWatchFn {
    if (!this.chokidarWatch) {
      try {
        const chokidar = require('chokidar');
        this.chokidarWatch = (p: string, opts?: any) => chokidar.watch(p, opts);
      } catch {
        throw new Error('chokidar 不可用，文件监听功能需要安装 chokidar 依赖');
      }
    }
    return this.chokidarWatch;
  }

  async addSource(localPath: string): Promise<WatchSource> {
    const source: WatchSource = {
      id: uuidv4(),
      localPath,
      remoteDir: `/apps/同步/${path.basename(localPath)}`,
      status: 'active',
      filterRules: [],
      createdAt: Date.now(),
    };

    try {
      const watcher = this.getChokidarWatch()(localPath, {
        ignoreInitial: true,
        awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 },
      });

      const handleChange = (changedPath: string) => {
        const key = changedPath;
        if (this.changeTimers.has(key)) {
          clearTimeout(this.changeTimers.get(key)!);
        }
        this.changeTimers.set(key, setTimeout(() => {
          this.changeTimers.delete(key);
          this.onFileChanged?.(changedPath, source.id);
        }, this.debounceMs));
      };

      watcher.on('add', handleChange);
      watcher.on('change', handleChange);

      this.watchers.set(source.id, watcher);
      this.sources.set(source.id, source);
    } catch (err: any) {
      source.status = 'error';
      source.errorMessage = err.message ?? '无法启动文件监听';
      this.sources.set(source.id, source);
    }

    return source;
  }

  async removeSource(sourceId: string): Promise<void> {
    const watcher = this.watchers.get(sourceId);
    if (watcher) {
      await watcher.close();
      this.watchers.delete(sourceId);
    }
    this.sources.delete(sourceId);
  }

  pauseSource(sourceId: string): void {
    const source = this.sources.get(sourceId);
    if (source) source.status = 'paused';
  }

  resumeSource(sourceId: string): void {
    const source = this.sources.get(sourceId);
    if (source) source.status = 'active';
  }

  getSources(): WatchSource[] {
    return Array.from(this.sources.values());
  }

  async destroy(): Promise<void> {
    for (const [id, watcher] of this.watchers) {
      await watcher.close();
    }
    this.watchers.clear();
    this.sources.clear();
    for (const timer of this.changeTimers.values()) {
      clearTimeout(timer);
    }
    this.changeTimers.clear();
  }

  /** 测试辅助：模拟文件变更事件（生产环境由 chokidar 触发） */
  _simulateChange(localPath: string, sourceId: string): void {
    this.onFileChanged?.(localPath, sourceId);
  }
}
