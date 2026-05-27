/** TransferPanel 组件 — 传输任务列表 */
import React, { useState } from 'react';
import { useTransferTasks } from '../../hooks/useTransferTasks';
import { useElectronAPI } from '../../hooks/useIpc';
import { TaskRow } from './TaskRow';
import { Button } from '../common/Button';

export const TransferPanel: React.FC = () => {
  const { tasks, setTasks } = useTransferTasks();
  const [showCompleted, setShowCompleted] = useState(true);
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

  const activeTasks = tasks.filter((t) => t.status !== 'completed');
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  const handleClearCompleted = () => {
    setTasks((prev) => prev.filter((t) => t.status !== 'completed'));
  };

  // 按状态排序：传输中 > 等待中 > 暂停 > 失败
  const sortOrder: Record<string, number> = { transferring: 0, pending: 1, paused: 2, failed: 3 };
  const sortedActive = [...activeTasks].sort((a, b) => (sortOrder[a.status] ?? 5) - (sortOrder[b.status] ?? 5));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)' }}>
        传输任务 ({activeTasks.length + completedTasks.length})
      </h2>

      {sortedActive.length === 0 && completedTasks.length === 0 ? (
        <p style={{ color: 'var(--text-tertiary)', padding: 'var(--space-8)', textAlign: 'center' }}>
          暂无传输任务
        </p>
      ) : (
        <>
          {sortedActive.length > 0 && (
            <p style={{
              color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)',
              fontWeight: 'var(--font-medium)', margin: 0, marginBottom: -4,
            }}>
              进行中
            </p>
          )}
          {sortedActive.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onPause={handlePause}
              onCancel={handleCancel}
              onRetry={handleRetry}
            />
          ))}

          {completedTasks.length > 0 && (
            <div style={{ marginTop: 'var(--space-2)' }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: showCompleted ? 'var(--space-2)' : 0,
              }}>
                <button
                  onClick={() => setShowCompleted((v) => !v)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                    border: 'none', background: 'transparent', cursor: 'pointer',
                    color: 'var(--text-secondary)', fontSize: 'var(--text-sm)',
                    fontWeight: 'var(--font-medium)', padding: 0,
                  }}
                >
                  <span style={{ transform: showCompleted ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', fontSize: 10 }}>
                    ▶
                  </span>
                  已完成 ({completedTasks.length})
                </button>
                <Button size="sm" variant="ghost" onClick={handleClearCompleted}>清除已完成</Button>
              </div>
              {showCompleted && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {completedTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onPause={handlePause}
                      onCancel={handleCancel}
                      onRetry={handleRetry}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
