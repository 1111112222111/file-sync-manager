/** TransferPanel 组件 — 传输任务列表 */
import React from 'react';
import { useTransferTasks } from '../../hooks/useTransferTasks';
import { useElectronAPI } from '../../hooks/useIpc';
import { TaskRow } from './TaskRow';

export const TransferPanel: React.FC = () => {
  const { tasks, setTasks } = useTransferTasks();
  const api = useElectronAPI();

  // 初始加载
  React.useEffect(() => {
    if (api) {
      api.syncGetTasks().then(setTasks);
    }
  }, [api, setTasks]);

  const handlePause = (id: string) => { api?.syncPauseTask(id); };
  const handleCancel = (id: string) => { api?.syncCancelTask(id); };
  const handleRetry = (id: string) => { api?.syncRetryTask(id); };

  // 按状态排序：传输中 > 等待中 > 暂停 > 失败 > 已完成
  const sorted = [...tasks].sort((a, b) => {
    const order: Record<string, number> = { transferring: 0, pending: 1, paused: 2, failed: 3, completed: 4 };
    return (order[a.status] ?? 5) - (order[b.status] ?? 5);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)' }}>
        传输任务 ({tasks.length})
      </h2>
      {sorted.length === 0 ? (
        <p style={{ color: 'var(--text-tertiary)', padding: 'var(--space-8)', textAlign: 'center' }}>
          暂无传输任务
        </p>
      ) : (
        sorted.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            onPause={handlePause}
            onCancel={handleCancel}
            onRetry={handleRetry}
          />
        ))
      )}
    </div>
  );
};
