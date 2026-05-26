/**
 * src/main/sync/conflict-detector.ts — 冲突检测与处理
 *
 * 职责：
 * - 上传前比较本地/云端文件修改时间
 * - 判定是否存在冲突（云端版本更新于本地版本）
 * - 提供用户选择的冲突解决机制
 */

import * as fs from 'fs';
import type { ICloudAdapter } from '../cloud/adapter.interface';
import type { ConflictInfo, ConflictChoice } from '../../shared/types';

/** 有效的冲突选择 */
const VALID_CHOICES: ConflictChoice[] = ['local', 'remote', 'both'];

export class ConflictDetector {
  private adapter: ICloudAdapter;

  /** 冲突解决后的回调（由 SyncEngine 或 IPC 层注册） */
  public onResolved?: (taskId: string, choice: ConflictChoice) => void;

  constructor(adapter: ICloudAdapter) {
    this.adapter = adapter;
  }

  /**
   * 检查是否存在冲突。
   * 云端文件更新于本地文件 → 返回 ConflictInfo
   * 云端文件不存在或本地更新 → 返回 null（无冲突）
   */
  async checkConflict(
    localPath: string,
    remotePath: string,
  ): Promise<ConflictInfo | null> {
    // 获取本地文件信息
    const localStat = fs.statSync(localPath);
    const localMtime = localStat.mtimeMs;

    // 尝试获取远程文件信息
    let remoteFile: { size: number; mtime: number };
    try {
      remoteFile = await this.adapter.getFileInfo(remotePath);
    } catch {
      // 远程文件不存在 → 无冲突（首次上传）
      return null;
    }

    // 将远程 mtime（秒级 Unix timestamp）转为毫秒
    const remoteMtimeMs = remoteFile.mtime * 1000;

    // 云端不比本地更新 → 无冲突
    if (remoteMtimeMs <= localMtime) {
      return null;
    }

    // 云端更新 → 存在冲突
    return {
      taskId: '', // 由调用方（SyncEngine）填充
      localPath,
      remotePath,
      localFile: {
        size: localStat.size,
        mtime: localMtime,
      },
      remoteFile: {
        size: remoteFile.size,
        mtime: remoteMtimeMs,
      },
    };
  }

  /**
   * 执行用户选择的冲突处理。
   * - 'local'：保留本地版本，允许上传覆盖云端
   * - 'remote'：保留云端版本，跳过上传
   * - 'both'：保留两份（重命名本地文件后上传）
   */
  async resolveConflict(taskId: string, choice: ConflictChoice): Promise<void> {
    if (!VALID_CHOICES.includes(choice)) {
      throw new Error(`无效的冲突处理选择: ${choice}。可选值: local / remote / both`);
    }

    // 触发回调通知外部（SyncEngine 根据 choice 采取不同行为）
    this.onResolved?.(taskId, choice);
  }
}
