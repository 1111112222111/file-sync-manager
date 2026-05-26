/** TaskRow 组件 — 单个传输任务行 */
import React from 'react';
import { ProgressBar } from '../common/ProgressBar';
import { Button } from '../common/Button';
import type { TransferTask } from '../../../shared/types';

interface TaskRowProps {
  task: TransferTask;
  onPause?: (id: string) => void;
  onCancel?: (id: string) => void;
  onRetry?: (id: string) => void;
}

const statusColors: Record<string, string> = {
  transferring: 'var(--status-info)',
  completed: 'var(--status-success)',
  failed: 'var(--status-error)',
  paused: 'var(--status-paused)',
  pending: 'var(--status-pending)',
};

const statusLabels: Record<string, string> = {
  transferring: '传输中',
  completed: '已完成',
  failed: '失败',
  paused: '已暂停',
  pending: '等待中',
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec === 0) return '';
  return `${formatSize(bytesPerSec)}/s`;
}

function getFileName(path: string): string {
  return path.replace(/\\/g, '/').split('/').pop() ?? path;
}

export const TaskRow: React.FC<TaskRowProps> = ({ task, onPause, onCancel, onRetry }) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-1)',
        padding: 'var(--space-3) var(--space-4)',
        background: 'var(--bg-secondary)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flex: 1, minWidth: 0 }}>
          <span
            style={{
              width: 8, height: 8, borderRadius: 'var(--radius-full)',
              background: statusColors[task.status] ?? 'var(--text-tertiary)',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              color: 'var(--text-primary)',
              fontSize: 'var(--text-sm)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={task.localPath}
          >
            {getFileName(task.localPath)}
          </span>
          <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', flexShrink: 0 }}>
            {task.direction === 'upload' ? '上传' : '下载'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
          <span style={{ color: statusColors[task.status], fontSize: 'var(--text-xs)', fontWeight: 'var(--font-medium)' }}>
            {statusLabels[task.status]}
          </span>
          <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>
            {formatSize(task.fileSize)}
          </span>
        </div>
      </div>

      {(task.status === 'transferring' || task.status === 'completed') && (
        <ProgressBar
          percent={task.progress}
          color={task.status === 'completed' ? 'var(--status-success)' : undefined}
        />
      )}

      {task.status === 'transferring' && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>
            {task.progress}% {formatSpeed(task.speed)}
          </span>
          <Button size="sm" variant="ghost" onClick={() => onPause?.(task.id)}>
            暂停
          </Button>
        </div>
      )}

      {(task.status === 'failed' || task.status === 'paused') && (
        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
          {task.status === 'failed' && (
            <Button size="sm" variant="secondary" onClick={() => onRetry?.(task.id)}>重试</Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => onCancel?.(task.id)}>取消</Button>
        </div>
      )}
    </div>
  );
};
