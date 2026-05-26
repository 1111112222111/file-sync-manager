/** ConflictDialog 组件 — 冲突弹窗 */
import React from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import type { ConflictInfo, ConflictChoice } from '../../../shared/types';

interface ConflictDialogProps {
  conflict: ConflictInfo | null;
  onResolve: (taskId: string, choice: ConflictChoice) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleString('zh-CN');
}

export const ConflictDialog: React.FC<ConflictDialogProps> = ({ conflict, onResolve }) => {
  if (!conflict) return null;

  return (
    <Modal open={true} onClose={() => {}} title="文件冲突" width="var(--modal-width-lg)">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
          云端文件版本比本地更新，请选择如何处理：
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
          {/* 本地文件 */}
          <div style={{
            padding: 'var(--space-3)',
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
          }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
              本地版本
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
              <div>大小: {formatSize(conflict.localFile.size)}</div>
              <div>修改时间: {formatTime(conflict.localFile.mtime)}</div>
            </div>
          </div>

          {/* 云端文件 */}
          <div style={{
            padding: 'var(--space-3)',
            background: 'var(--status-warning-bg)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--status-warning-border)',
          }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--status-warning)', marginBottom: 'var(--space-2)' }}>
              云端版本（更新）
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
              <div>大小: {formatSize(conflict.remoteFile.size)}</div>
              <div>修改时间: {formatTime(conflict.remoteFile.mtime)}</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
          <Button variant="primary" onClick={() => onResolve(conflict.taskId, 'local')}>
            保留本地版本
          </Button>
          <Button variant="secondary" onClick={() => onResolve(conflict.taskId, 'remote')}>
            保留云端版本
          </Button>
          <Button variant="ghost" onClick={() => onResolve(conflict.taskId, 'both')}>
            保留两份
          </Button>
        </div>
      </div>
    </Modal>
  );
};
