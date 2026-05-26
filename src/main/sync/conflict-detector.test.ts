/**
 * src/main/sync/conflict-detector.test.ts
 *
 * ConflictDetector 行为测试。
 * Mock fs 和 ICloudAdapter，验证冲突检测逻辑和解决策略。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictDetector } from './conflict-detector';
import type { ICloudAdapter } from '../cloud/adapter.interface';
import type { ConflictInfo, ConflictChoice } from '../../shared/types';

// ─── Mock fs ───
vi.mock('fs', () => {
  const statResults: Record<string, { size: number; mtimeMs: number }> = {};
  return {
    default: {
      statSync: vi.fn((p: string) => {
        const result = statResults[p];
        if (!result) throw new Error(`ENOENT: ${p}`);
        return {
          size: result.size,
          mtimeMs: result.mtimeMs,
          isFile: () => true,
        };
      }),
      existsSync: vi.fn((p: string) => p in statResults),
    },
    statSync: vi.fn((p: string) => {
      const result = statResults[p];
      if (!result) throw new Error(`ENOENT: ${p}`);
      return {
        size: result.size,
        mtimeMs: result.mtimeMs,
        isFile: () => true,
      };
    }),
    existsSync: vi.fn((p: string) => p in statResults),
    // 允许动态设置
    __setFile: (path: string, size: number, mtimeMs: number) => {
      statResults[path] = { size, mtimeMs };
    },
    __clear: () => {
      Object.keys(statResults).forEach((k) => delete statResults[k]);
    },
  };
});

import * as fsMock from 'fs';

// ─── 辅助 ───

function createMockAdapter(remoteFiles: Record<string, { size: number; mtime: number }> = {}): ICloudAdapter {
  return {
    upload: vi.fn(),
    download: vi.fn(),
    listFiles: vi.fn(),
    deleteFile: vi.fn(),
    getFileInfo: vi.fn(async (remotePath: string) => {
      const info = remoteFiles[remotePath];
      if (!info) throw new Error('File not found');
      return {
        name: remotePath.split('/').pop() ?? remotePath,
        path: remotePath,
        size: info.size,
        mtime: info.mtime,
        isDir: false,
      };
    }),
    getQuota: vi.fn(),
  };
}

function setLocalFile(path: string, size: number, mtimeMs: number): void {
  (fsMock as any).__setFile(path, size, mtimeMs);
}

describe('ConflictDetector', () => {
  let adapter: ICloudAdapter;
  let detector: ConflictDetector;

  beforeEach(() => {
    adapter = createMockAdapter();
    detector = new ConflictDetector(adapter);
    (fsMock as any).__clear();
  });

  // ─── checkConflict ───
  describe('checkConflict', () => {
    it('本地文件比云端更新时应返回 null（无冲突）', async () => {
      // 本地文件：修改时间 2024-06-01
      setLocalFile('/local/test.txt', 1024, new Date('2024-06-01T12:00:00Z').getTime());

      const remoteFiles = {
        '/remote/test.txt': { size: 512, mtime: Math.floor(new Date('2024-05-01T12:00:00Z').getTime() / 1000) },
      };
      detector = new ConflictDetector(createMockAdapter(remoteFiles));

      const result = await detector.checkConflict('/local/test.txt', '/remote/test.txt');
      expect(result).toBeNull();
    });

    it('云端文件比本地更新时应返回 ConflictInfo（冲突）', async () => {
      // 本地文件：修改时间 2024-05-01
      setLocalFile('/local/test.txt', 1024, new Date('2024-05-01T12:00:00Z').getTime());

      const remoteFiles = {
        '/remote/test.txt': { size: 2048, mtime: Math.floor(new Date('2024-06-01T12:00:00Z').getTime() / 1000) },
      };
      detector = new ConflictDetector(createMockAdapter(remoteFiles));

      const result = await detector.checkConflict('/local/test.txt', '/remote/test.txt');
      expect(result).not.toBeNull();
      expect(result!.localFile.mtime).toBe(new Date('2024-05-01T12:00:00Z').getTime());
      expect(result!.remoteFile.mtime).toBe(new Date('2024-06-01T12:00:00Z').getTime());
    });

    it('云端文件不存在时应返回 null（首次上传，无冲突）', async () => {
      setLocalFile('/local/newfile.txt', 512, Date.now());

      const remoteFiles: Record<string, { size: number; mtime: number }> = {};
      detector = new ConflictDetector(createMockAdapter(remoteFiles));

      const result = await detector.checkConflict('/local/newfile.txt', '/remote/newfile.txt');
      expect(result).toBeNull();
    });

    it('本地文件不存在时应抛出异常', async () => {
      const remoteFiles = {
        '/remote/test.txt': { size: 512, mtime: Math.floor(Date.now() / 1000) },
      };
      detector = new ConflictDetector(createMockAdapter(remoteFiles));

      await expect(
        detector.checkConflict('/local/nonexistent.txt', '/remote/test.txt'),
      ).rejects.toThrow();
    });

    it('相同修改时间的文件应视为无冲突', async () => {
      const sameTime = new Date('2024-06-01T12:00:00Z').getTime();
      setLocalFile('/local/same.txt', 1024, sameTime);

      const sameTimeSec = Math.floor(sameTime / 1000);
      const remoteFiles = {
        '/remote/same.txt': { size: 1024, mtime: sameTimeSec },
      };
      detector = new ConflictDetector(createMockAdapter(remoteFiles));

      const result = await detector.checkConflict('/local/same.txt', '/remote/same.txt');
      expect(result).toBeNull();
    });
  });

  // ─── resolveConflict ───
  describe('resolveConflict', () => {
    it('选择 local 时应 resolve 且不抛异常', async () => {
      // resolveConflict 返回 void，不抛异常即成功
      await expect(
        detector.resolveConflict('task-123', 'local'),
      ).resolves.toBeUndefined();
    });

    it('选择 remote 时应 resolve 且不抛异常', async () => {
      await expect(
        detector.resolveConflict('task-456', 'remote'),
      ).resolves.toBeUndefined();
    });

    it('选择 both 时应 resolve 且不抛异常', async () => {
      await expect(
        detector.resolveConflict('task-789', 'both'),
      ).resolves.toBeUndefined();
    });

    it('resolveConflict 应触发 onResolved 回调', async () => {
      const onResolved = vi.fn();
      detector.onResolved = onResolved;

      await detector.resolveConflict('task-abc', 'local');

      expect(onResolved).toHaveBeenCalledWith('task-abc', 'local');
    });

    it('无效的 choice 应抛出异常', async () => {
      await expect(
        detector.resolveConflict('task-xyz', 'invalid' as ConflictChoice),
      ).rejects.toThrow();
    });
  });
});
