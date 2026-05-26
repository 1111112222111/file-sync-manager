/**
 * src/main/sync/sync-engine.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncEngine } from './sync-engine';
import type { ICloudAdapter } from '../cloud/adapter.interface';
import type { TransferQueue } from './transfer-queue';
import type { ConflictDetector } from './conflict-detector';
import type { FilterManager } from '../config/filter-manager';
import type { SyncStatus } from '../../shared/types';

// Mock fs
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(true),
    statSync: vi.fn().mockReturnValue({ size: 1024, mtimeMs: Date.now() }),
  },
  existsSync: vi.fn().mockReturnValue(true),
  statSync: vi.fn().mockReturnValue({ size: 1024, mtimeMs: Date.now() }),
}));

describe('SyncEngine', () => {
  let adapter: ICloudAdapter;
  let queue: TransferQueue;
  let conflictDetector: ConflictDetector;
  let filterManager: FilterManager;
  let engine: SyncEngine;

  beforeEach(() => {
    adapter = {
      upload: vi.fn().mockResolvedValue({ success: true, remotePath: '/remote/test.txt', size: 1024 }),
      download: vi.fn().mockResolvedValue({ success: true, localPath: '/local/test.txt', size: 1024 }),
      listFiles: vi.fn().mockResolvedValue([]),
      deleteFile: vi.fn().mockResolvedValue({ success: true }),
      getFileInfo: vi.fn().mockRejectedValue(new Error('Not found')),
      getQuota: vi.fn().mockResolvedValue({ total: 1024 * 1024 * 1024, used: 0 }),
    };

    queue = {
      addTask: vi.fn().mockReturnValue('task-uuid'),
      pauseTask: vi.fn(),
      resumeTask: vi.fn(),
      cancelTask: vi.fn(),
      retryTask: vi.fn(),
      getAllTasks: vi.fn().mockReturnValue([]),
      getStats: vi.fn().mockReturnValue({ pending: 0, transferring: 0, completed: 0, failed: 0, paused: 0 }),
      persistQueue: vi.fn(),
      restoreQueue: vi.fn(),
      setConcurrency: vi.fn(),
      destroy: vi.fn(),
    } as unknown as TransferQueue;

    conflictDetector = {
      checkConflict: vi.fn().mockResolvedValue(null),
      resolveConflict: vi.fn().mockResolvedValue(undefined),
    } as unknown as ConflictDetector;

    filterManager = {
      addRule: vi.fn().mockReturnValue({ id: '1', pattern: '*', enabled: true }),
      removeRule: vi.fn().mockReturnValue(true),
      getRules: vi.fn().mockReturnValue([]),
      shouldExclude: vi.fn().mockReturnValue(false),
    } as unknown as FilterManager;

    engine = new SyncEngine(adapter, queue, conflictDetector, filterManager);
  });

  // ─── handleDropUpload ───
  describe('handleDropUpload', () => {
    it('应将文件路径转为上传任务添加到队列', async () => {
      await engine.handleDropUpload(['/local/file1.txt', '/local/file2.txt']);

      expect(queue.addTask).toHaveBeenCalledTimes(2);
      expect(queue.addTask).toHaveBeenCalledWith(
        expect.objectContaining({ localPath: '/local/file1.txt', direction: 'upload' }),
      );
    });

    it('无冲突时应直接添加任务', async () => {
      (conflictDetector.checkConflict as any).mockResolvedValue(null);

      await engine.handleDropUpload(['/local/test.txt']);

      expect(queue.addTask).toHaveBeenCalled();
    });

    it('有冲突时应触发 onConflict 回调而不添加任务', async () => {
      (
        conflictDetector.checkConflict as any).mockResolvedValue({
        taskId: '', localPath: '/local/test.txt', remotePath: '/remote/test.txt',
        localFile: { size: 1024, mtime: 1000 },
        remoteFile: { size: 2048, mtime: 2000 },
      });

      const onConflict = vi.fn();
      engine.onConflict = onConflict;

      await engine.handleDropUpload(['/local/test.txt']);

      expect(onConflict).toHaveBeenCalled();
      // 冲突时不应添加任务
      expect(queue.addTask).not.toHaveBeenCalled();
    });
  });

  // ─── handleFileChange ───
  describe('handleFileChange', () => {
    it('应通过过滤检查后添加上传任务', async () => {
      (filterManager.shouldExclude as any).mockReturnValue(false);

      await engine.handleFileChange('/local/changed.txt', 'watch-source-1');

      expect(filterManager.shouldExclude).toHaveBeenCalled();
      expect(queue.addTask).toHaveBeenCalled();
    });

    it('被过滤的文件应跳过不上传', async () => {
      (filterManager.shouldExclude as any).mockReturnValue(true);

      await engine.handleFileChange('/local/changed.tmp', 'watch-source-1');

      expect(queue.addTask).not.toHaveBeenCalled();
    });
  });

  // ─── handleDownload ───
  describe('handleDownload', () => {
    it('应添加下载任务到队列', async () => {
      await engine.handleDownload('/remote/file.txt', '/local/downloads/file.txt');

      expect(queue.addTask).toHaveBeenCalledWith(
        expect.objectContaining({
          remotePath: '/remote/file.txt',
          localPath: '/local/downloads/file.txt',
          direction: 'download',
        }),
      );
    });
  });

  // ─── getSyncStatus ───
  describe('getSyncStatus', () => {
    it('应返回同步状态摘要', () => {
      (queue.getStats as any).mockReturnValue({
        pending: 2, transferring: 1, completed: 5, failed: 0, paused: 1,
      });

      const status: SyncStatus = engine.getSyncStatus();

      expect(status.isSyncing).toBe(true);
      expect(status.pendingCount).toBe(2);
      expect(status.completedToday).toBeGreaterThanOrEqual(0);
    });
  });
});
