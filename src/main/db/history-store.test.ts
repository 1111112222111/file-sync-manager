/**
 * src/main/db/history-store.test.ts
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { HistoryStore } from './history-store';
import type { TransferRecord } from '../../shared/types';

describe('HistoryStore', () => {
  let store: HistoryStore;

  beforeEach(() => {
    store = new HistoryStore();
  });

  describe('add / getList', () => {
    it('应存储传输记录并能查询', () => {
      const record: TransferRecord = {
        id: '1', fileName: 'test.txt', fileSize: 1024,
        direction: 'upload', status: 'completed', remotePath: '/remote/test.txt',
        localPath: '/local/test.txt', errorMessage: null,
        startedAt: Date.now() - 60000, completedAt: Date.now(),
      };
      store.add(record);

      const records = store.getList({ limit: 10, offset: 0 });
      expect(records).toHaveLength(1);
      expect(records[0].fileName).toBe('test.txt');
    });

    it('按 limit 和 offset 分页', () => {
      for (let i = 0; i < 5; i++) {
        store.add({
          id: `${i}`, fileName: `file${i}.txt`, fileSize: 100,
          direction: 'upload', status: 'completed', remotePath: `/remote/file${i}.txt`,
          localPath: `/local/file${i}.txt`, errorMessage: null,
          startedAt: Date.now(), completedAt: Date.now(),
        });
      }

      const page1 = store.getList({ limit: 2, offset: 0 });
      expect(page1).toHaveLength(2);

      const page2 = store.getList({ limit: 2, offset: 2 });
      expect(page2).toHaveLength(2);
    });

    it('空记录时返回空数组', () => {
      expect(store.getList()).toHaveLength(0);
    });

    it('记录 failed 状态', () => {
      store.add({
        id: 'fail-1', fileName: 'bigfile.iso', fileSize: 5000000,
        direction: 'upload', status: 'failed', remotePath: '/remote/bigfile.iso',
        localPath: '/local/bigfile.iso', errorMessage: '网络超时',
        startedAt: Date.now(), completedAt: Date.now(),
      });

      const records = store.getList();
      expect(records[0].status).toBe('failed');
      expect(records[0].errorMessage).toBe('网络超时');
    });
  });
});
