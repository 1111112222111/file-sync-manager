/**
 * src/main/sync/transfer-queue.test.ts
 *
 * TransferQueue 行为测试。
 * Mock ICloudAdapter，验证队列的并发控制、状态管理、重试逻辑。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TransferQueue } from './transfer-queue';
import type { ICloudAdapter } from '../cloud/adapter.interface';
import type { TransferTask, QueueStats, CreateTaskInput } from '../../shared/types';

// ─── 辅助：轮询等待条件满足 ───
function waitForCondition(
  condition: () => boolean,
  timeoutMs = 2000,
  intervalMs = 50,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (condition()) {
        resolve();
      } else if (Date.now() - start >= timeoutMs) {
        reject(new Error(`Condition not met within ${timeoutMs}ms`));
      } else {
        setTimeout(check, intervalMs);
      }
    };
    check();
  });
}

// ─── Mock ICloudAdapter ───

function createMockAdapter(): ICloudAdapter {
  return {
    upload: vi.fn().mockResolvedValue({ success: true, remotePath: '/remote/test.txt', size: 1024 }),
    download: vi.fn().mockResolvedValue({ success: true, localPath: '/local/test.txt', size: 1024 }),
    listFiles: vi.fn().mockResolvedValue([]),
    deleteFile: vi.fn().mockResolvedValue({ success: true }),
    getFileInfo: vi.fn().mockResolvedValue({ name: 'test.txt', path: '/remote/test.txt', size: 1024, mtime: 1716912000, isDir: false }),
    getQuota: vi.fn().mockResolvedValue({ total: 1024 * 1024 * 1024, used: 512 * 1024 * 1024 }),
  };
}

function createUploadTask(overrides: Partial<CreateTaskInput> = {}): CreateTaskInput {
  return {
    localPath: '/local/test.txt',
    remotePath: '/remote/test.txt',
    direction: 'upload',
    fileSize: 2048,
    ...overrides,
  };
}

describe('TransferQueue', () => {
  let adapter: ICloudAdapter;
  let queue: TransferQueue;

  beforeEach(() => {
    adapter = createMockAdapter();
    queue = new TransferQueue(adapter);
  });

  afterEach(async () => {
    queue.destroy();
  });

  // ─── addTask ───
  describe('addTask', () => {
    it('应添加任务并返回唯一 taskId', () => {
      const taskId = queue.addTask(createUploadTask());
      expect(taskId).toBeDefined();
      expect(typeof taskId).toBe('string');
    });

    it('每个任务应有唯一的 id', () => {
      const id1 = queue.addTask(createUploadTask({ localPath: '/local/file1.txt' }));
      const id2 = queue.addTask(createUploadTask({ localPath: '/local/file2.txt' }));
      expect(id1).not.toBe(id2);
    });

    it('并发为 0 时任务保持 pending', () => {
      queue.setConcurrency(0);
      const taskId = queue.addTask(createUploadTask());
      const task = queue.getAllTasks().find((t: TransferTask) => t.id === taskId);
      expect(task?.status).toBe('pending');
    });

    it('正常并发下任务应自动完成', async () => {
      const taskId = queue.addTask(createUploadTask());

      await waitForCondition(() => {
        const task = queue.getAllTasks().find((t: TransferTask) => t.id === taskId);
        return task?.status === 'completed';
      });

      const task = queue.getAllTasks().find((t: TransferTask) => t.id === taskId);
      expect(task?.status).toBe('completed');
    });
  });

  // ─── 并发控制 ───
  describe('并发控制', () => {
    it('同时进行的任务数不应超过并发上限（默认 3）', async () => {
      const slowAdapter = createMockAdapter();
      slowAdapter.upload = vi.fn().mockImplementation(
        () => new Promise(() => { /* 永不 resolve */ }),
      );

      const slowQueue = new TransferQueue(slowAdapter);

      for (let i = 0; i < 5; i++) {
        slowQueue.addTask(createUploadTask({ localPath: `/local/file${i}.txt` }));
      }

      await waitForCondition(() => {
        const stats = slowQueue.getStats();
        return stats.transferring <= 3 && stats.pending >= 2;
      });

      const stats = slowQueue.getStats();
      expect(stats.transferring).toBeLessThanOrEqual(3);

      slowQueue.destroy();
    });

    it('可以通过 setConcurrency 调整并发上限', () => {
      queue.setConcurrency(5);
      queue.setConcurrency(0);
      queue.setConcurrency(3);
      // 不抛异常即成功
    });
  });

  // ─── pauseTask ───
  describe('pauseTask', () => {
    it('应暂停正在传输的任务', async () => {
      const slowAdapter = createMockAdapter();
      slowAdapter.upload = vi.fn().mockImplementation(
        () => new Promise(() => { /* 永不 resolve */ }),
      );
      const slowQueue = new TransferQueue(slowAdapter);

      const taskId = slowQueue.addTask(createUploadTask());

      await waitForCondition(() => {
        const task = slowQueue.getAllTasks().find((t: TransferTask) => t.id === taskId);
        return task?.status === 'transferring';
      });

      slowQueue.pauseTask(taskId);

      const task = slowQueue.getAllTasks().find((t: TransferTask) => t.id === taskId);
      expect(task?.status).toBe('paused');

      slowQueue.destroy();
    });

    it('暂停 pending 状态的任务应变为 paused', () => {
      const noConcurrencyQueue = new TransferQueue(adapter);
      noConcurrencyQueue.setConcurrency(0);

      const taskId = noConcurrencyQueue.addTask(createUploadTask());
      noConcurrencyQueue.pauseTask(taskId);

      const task = noConcurrencyQueue.getAllTasks().find((t: TransferTask) => t.id === taskId);
      expect(task?.status).toBe('paused');

      noConcurrencyQueue.destroy();
    });
  });

  // ─── resumeTask ───
  describe('resumeTask', () => {
    it('应恢复被暂停的任务并执行完成', async () => {
      const noConcurrencyQueue = new TransferQueue(adapter);
      noConcurrencyQueue.setConcurrency(0);

      const taskId = noConcurrencyQueue.addTask(createUploadTask());
      noConcurrencyQueue.pauseTask(taskId);

      expect(noConcurrencyQueue.getAllTasks().find((t: TransferTask) => t.id === taskId)?.status).toBe('paused');

      noConcurrencyQueue.resumeTask(taskId);
      noConcurrencyQueue.setConcurrency(1);

      await waitForCondition(() => {
        const task = noConcurrencyQueue.getAllTasks().find((t: TransferTask) => t.id === taskId);
        return task?.status === 'completed';
      });

      noConcurrencyQueue.destroy();
    });
  });

  // ─── cancelTask ───
  describe('cancelTask', () => {
    it('应取消任务并将其从队列中移除', () => {
      const taskId = queue.addTask(createUploadTask());
      queue.cancelTask(taskId);

      const task = queue.getAllTasks().find((t: TransferTask) => t.id === taskId);
      expect(task).toBeUndefined();
    });
  });

  // ─── retryTask ───
  describe('retryTask', () => {
    it('任务失败后内部重试应成功', async () => {
      let callCount = 0;
      const retryAdapter = createMockAdapter();
      retryAdapter.upload = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ success: false, remotePath: '/remote/test.txt', size: 0, error: 'Network error' });
        }
        return Promise.resolve({ success: true, remotePath: '/remote/test.txt', size: 1024 });
      });

      const retryQueue = new TransferQueue(retryAdapter);
      const taskId = retryQueue.addTask(createUploadTask());

      // 首次重试延迟 1s
      await waitForCondition(() => {
        const task = retryQueue.getAllTasks().find((t: TransferTask) => t.id === taskId);
        return task?.status === 'completed';
      }, 5000, 100);

      const task = retryQueue.getAllTasks().find((t: TransferTask) => t.id === taskId);
      expect(task?.status).toBe('completed');

      retryQueue.destroy();
    }, 10000);
  });

  // ─── getAllTasks ───
  describe('getAllTasks', () => {
    it('应返回所有已添加的任务', () => {
      queue.addTask(createUploadTask({ localPath: '/local/a.txt' }));
      queue.addTask(createUploadTask({ localPath: '/local/b.txt' }));

      const allTasks = queue.getAllTasks();
      expect(allTasks).toHaveLength(2);
    });

    it('任务完成后应保留在列表中', async () => {
      const taskId = queue.addTask(createUploadTask());

      await waitForCondition(() => {
        const task = queue.getAllTasks().find((t: TransferTask) => t.id === taskId);
        return task?.status === 'completed';
      });

      const task = queue.getAllTasks().find((t: TransferTask) => t.id === taskId);
      expect(task).toBeDefined();
      expect(task?.status).toBe('completed');
    });
  });

  // ─── getStats ───
  describe('getStats', () => {
    it('应返回正确的队列统计', () => {
      queue.addTask(createUploadTask({ localPath: '/local/a.txt' }));
      queue.addTask(createUploadTask({ localPath: '/local/b.txt' }));

      const stats: QueueStats = queue.getStats();
      expect(typeof stats.pending).toBe('number');
      expect(typeof stats.transferring).toBe('number');
      expect(typeof stats.completed).toBe('number');
      expect(typeof stats.failed).toBe('number');
      expect(typeof stats.paused).toBe('number');
    });
  });

  // ─── 重试次数限制 ───
  describe('重试次数限制', () => {
    it('失败超过最大重试次数（3 次）后应标记为 failed', async () => {
      const failAdapter = createMockAdapter();
      failAdapter.upload = vi.fn().mockResolvedValue({
        success: false,
        remotePath: '/remote/test.txt',
        size: 0,
        error: 'Persistent error',
      });

      const failQueue = new TransferQueue(failAdapter);
      const taskId = failQueue.addTask(createUploadTask());

      // 3 次重试 = 1s + 2s + 4s = 7s
      await waitForCondition(() => {
        const task = failQueue.getAllTasks().find((t: TransferTask) => t.id === taskId);
        return task?.status === 'failed';
      }, 15000, 200);

      const task = failQueue.getAllTasks().find((t: TransferTask) => t.id === taskId);
      expect(task?.status).toBe('failed');
      expect((task?.retryCount ?? 0)).toBeGreaterThanOrEqual(3);

      failQueue.destroy();
    }, 20000);
  });

  // ─── 传输方向 ───
  describe('传输方向', () => {
    it('上传任务应调用 adapter.upload', async () => {
      const taskId = queue.addTask(createUploadTask({ direction: 'upload' }));

      await waitForCondition(() => {
        const task = queue.getAllTasks().find((t: TransferTask) => t.id === taskId);
        return task?.status === 'completed';
      });

      expect(adapter.upload).toHaveBeenCalled();
    });

    it('下载任务应调用 adapter.download', async () => {
      const taskId = queue.addTask(createUploadTask({ direction: 'download' }));

      await waitForCondition(() => {
        const task = queue.getAllTasks().find((t: TransferTask) => t.id === taskId);
        return task?.status === 'completed';
      });

      expect(adapter.download).toHaveBeenCalled();
    });
  });

  // ─── 进度回调 ───
  describe('进度报告', () => {
    it('adapter 返回的进度应反映到任务对象', async () => {
      const progressingAdapter = createMockAdapter();
      progressingAdapter.upload = vi.fn().mockImplementation(
        async (_local: string, _remote: string, onProgress?: (p: number, s: number, e: number) => void) => {
          if (onProgress) {
            onProgress(50, 1024 * 1024, 2);
            onProgress(100, 0, 0);
          }
          return { success: true, remotePath: '/remote/test.txt', size: 1024 };
        },
      );

      const progressQueue = new TransferQueue(progressingAdapter);
      const taskId = progressQueue.addTask(createUploadTask());

      await waitForCondition(() => {
        const task = progressQueue.getAllTasks().find((t: TransferTask) => t.id === taskId);
        return task?.status === 'completed';
      });

      const task = progressQueue.getAllTasks().find((t: TransferTask) => t.id === taskId);
      expect(task?.progress).toBe(100);

      progressQueue.destroy();
    });
  });
});
