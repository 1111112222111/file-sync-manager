/**
 * src/main/sync/transfer-queue.ts — 传输队列管理
 *
 * 职责：
 * - 任务入队/调度（并发上限默认 3）
 * - 任务状态管理（pending / transferring / paused / completed / failed）
 * - 失败重试（最多 3 次，指数退避 1s/2s/4s）
 * - 暂停/恢复/取消操作
 * - 进度回调转发
 * - 队列统计
 */

import { v4 as uuidv4 } from 'uuid';
import type { ICloudAdapter } from '../cloud/adapter.interface';
import type { TransferTask, CreateTaskInput, QueueStats } from '../../shared/types';
import type { UploadResult, DownloadResult } from '../../shared/types';

/** 重试配置 */
const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [1000, 2000, 4000]; // 指数退避

/** 默认并发上限 */
const DEFAULT_CONCURRENCY = 3;

export class TransferQueue {
  private tasks: Map<string, TransferTask> = new Map();
  private adapter: ICloudAdapter;
  private concurrency: number;
  private activeCount = 0;
  private destroyed = false;

  /** 外部监听器：进度更新 */
  public onProgress?: (task: TransferTask) => void;
  /** 外部监听器：任务完成 */
  public onCompleted?: (task: TransferTask) => void;
  /** 外部监听器：任务失败 */
  public onFailed?: (task: TransferTask) => void;

  constructor(adapter: ICloudAdapter) {
    this.adapter = adapter;
    this.concurrency = DEFAULT_CONCURRENCY;
  }

  // ─── addTask ─────────────────────────────────────────────

  addTask(input: CreateTaskInput): string {
    const id = uuidv4();
    const task: TransferTask = {
      id,
      localPath: input.localPath,
      remotePath: input.remotePath,
      direction: input.direction,
      status: 'pending',
      progress: 0,
      speed: 0,
      eta: 0,
      retryCount: 0,
      fileSize: input.fileSize,
      transferredSize: 0,
      createdAt: Date.now(),
    };

    this.tasks.set(id, task);

    // 调度执行
    this.scheduleNext();

    return id;
  }

  // ─── pauseTask ───────────────────────────────────────────

  pauseTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    if (task.status === 'transferring') {
      this.activeCount = Math.max(0, this.activeCount - 1);
    }

    task.status = 'paused';
  }

  // ─── resumeTask ──────────────────────────────────────────

  resumeTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    if (task.status === 'paused' || task.status === 'failed') {
      task.status = 'pending';
      task.retryCount = Math.max(0, task.retryCount - 1); // 重置部分重试
      this.scheduleNext();
    }
  }

  // ─── cancelTask ──────────────────────────────────────────

  cancelTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    if (task.status === 'transferring') {
      this.activeCount = Math.max(0, this.activeCount - 1);
    }

    this.tasks.delete(taskId);
    this.scheduleNext();
  }

  // ─── retryTask ───────────────────────────────────────────

  retryTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'failed') return;

    task.status = 'pending';
    task.retryCount = 0;
    this.scheduleNext();
  }

  // ─── getAllTasks ─────────────────────────────────────────

  getAllTasks(): TransferTask[] {
    return Array.from(this.tasks.values());
  }

  // ─── getStats ────────────────────────────────────────────

  getStats(): QueueStats {
    let pending = 0;
    let transferring = 0;
    let completed = 0;
    let failed = 0;
    let paused = 0;

    for (const task of this.tasks.values()) {
      switch (task.status) {
        case 'pending': pending++; break;
        case 'transferring': transferring++; break;
        case 'completed': completed++; break;
        case 'failed': failed++; break;
        case 'paused': paused++; break;
      }
    }

    return { pending, transferring, completed, failed, paused };
  }

  // ─── setConcurrency ──────────────────────────────────────

  setConcurrency(n: number): void {
    this.concurrency = Math.max(0, n);
    this.scheduleNext();
  }

  // ─── destroy ─────────────────────────────────────────────

  destroy(): void {
    this.destroyed = true;
    // 重置所有进行中的任务为 pending
    for (const task of this.tasks.values()) {
      if (task.status === 'transferring') {
        task.status = 'pending';
      }
    }
    this.activeCount = 0;
  }

  // ─── persistQueue ────────────────────────────────────────

  persistQueue(): void {
    // TODO: 持久化到 SQLite（后续完善）
  }

  // ─── restoreQueue ────────────────────────────────────────

  async restoreQueue(): Promise<void> {
    // TODO: 从 SQLite 恢复队列（后续完善）
  }

  // ─── 内部：调度下一个任务 ────────────────────────────────

  private scheduleNext(): void {
    if (this.destroyed) return;

    while (this.activeCount < this.concurrency) {
      const nextTask = this.getNextPendingTask();
      if (!nextTask) break;

      this.activeCount++;
      this.executeTask(nextTask);
    }
  }

  // ─── 内部：获取下一个待处理任务 ──────────────────────────

  private getNextPendingTask(): TransferTask | undefined {
    for (const task of this.tasks.values()) {
      if (task.status === 'pending') {
        // 如果任务曾失败过且 retryCount >= MAX_RETRIES，跳过
        // 等待手动 retry
        return task;
      }
    }
    return undefined;
  }

  // ─── 内部：执行任务 ──────────────────────────────────────

  private async executeTask(task: TransferTask): Promise<void> {
    task.status = 'transferring';
    task.progress = 0;

    try {
      // 重试循环
      while (task.status === 'transferring' && task.retryCount <= MAX_RETRIES) {
        try {
          const result = await this.performTransfer(task);

          if (result.success) {
            task.status = 'completed';
            task.progress = 100;
            task.speed = 0;
            task.eta = 0;
            this.activeCount = Math.max(0, this.activeCount - 1);
            this.onCompleted?.(task);
            this.scheduleNext();
            return;
          } else {
            // 传输失败，检查是否可重试
            task.retryCount++;
            task.error = result.error || '传输失败';

            if (task.retryCount > MAX_RETRIES) {
              task.status = 'failed';
              this.activeCount = Math.max(0, this.activeCount - 1);
              this.onFailed?.(task);
              this.scheduleNext();
              return;
            }

            // 等待后重试
            const delay = RETRY_DELAYS_MS[Math.min(task.retryCount - 1, RETRY_DELAYS_MS.length - 1)];
            await this.sleep(delay);

            // 检查任务在等待期间是否被暂停或取消
            if (task.status !== 'transferring') {
              this.activeCount = Math.max(0, this.activeCount - 1);
              this.scheduleNext();
              return;
            }
          }
        } catch (err: any) {
          task.retryCount++;
          task.error = err.message || '未知错误';

          if (task.retryCount > MAX_RETRIES) {
            task.status = 'failed';
            this.activeCount = Math.max(0, this.activeCount - 1);
            this.onFailed?.(task);
            this.scheduleNext();
            return;
          }

          const delay = RETRY_DELAYS_MS[Math.min(task.retryCount - 1, RETRY_DELAYS_MS.length - 1)];
          await this.sleep(delay);

          if (task.status !== 'transferring') {
            this.activeCount = Math.max(0, this.activeCount - 1);
            this.scheduleNext();
            return;
          }
        }
      }
    } catch {
      // 兜底：标记失败
      task.status = 'failed';
      this.activeCount = Math.max(0, this.activeCount - 1);
      this.onFailed?.(task);
      this.scheduleNext();
    }
  }

  // ─── 内部：执行实际的上传或下载 ──────────────────────────

  private async performTransfer(
    task: TransferTask,
  ): Promise<UploadResult | DownloadResult> {
    const onProgress = (percent: number, speed: number, eta: number) => {
      task.progress = percent;
      task.speed = speed;
      task.eta = eta;
      task.transferredSize = Math.floor((percent / 100) * task.fileSize);
      this.onProgress?.(task);
    };

    if (task.direction === 'upload') {
      return this.adapter.upload(task.localPath, task.remotePath, onProgress);
    } else {
      return this.adapter.download(task.remotePath, task.localPath, onProgress);
    }
  }

  // ─── 内部：延迟 ──────────────────────────────────────────

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
