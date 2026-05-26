/**
 * src/main/db/history-store.ts — 传输历史记录
 *
 * 内存存储实现（生产环境替换为 better-sqlite3）
 */
import type { TransferRecord, HistoryQuery } from '../../shared/types';

export class HistoryStore {
  private records: TransferRecord[] = [];

  add(record: TransferRecord): void {
    this.records.push(record);
  }

  getList(query: HistoryQuery = {}): TransferRecord[] {
    const { limit = 50, offset = 0 } = query;
    return this.records.slice(offset, offset + limit);
  }
}
