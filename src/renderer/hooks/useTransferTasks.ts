/**
 * src/renderer/hooks/useTransferTasks.ts — 传输任务状态订阅
 */
import { useState, useCallback } from 'react';
import { useIpcEvent } from './useIpc';
import type { TransferTask } from '../../shared/types';

export function useTransferTasks(): {
  tasks: TransferTask[];
  setTasks: (tasks: TransferTask[]) => void;
} {
  const [tasks, setTasks] = useState<TransferTask[]>([]);

  useIpcEvent('transfer:taskAdded', useCallback((task: TransferTask) => {
    setTasks((prev) => {
      const exists = prev.some((t) => t.id === task.id);
      return exists ? prev : [...prev, task];
    });
  }, []));

  useIpcEvent('transfer:progress', useCallback((task: TransferTask) => {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
  }, []));

  useIpcEvent('transfer:completed', useCallback((task: TransferTask) => {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
  }, []));

  useIpcEvent('transfer:failed', useCallback((task: TransferTask) => {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
  }, []));

  useIpcEvent('transfer:updated', useCallback((task: TransferTask) => {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
  }, []));

  useIpcEvent('transfer:taskRemoved', useCallback((taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }, []));

  return { tasks, setTasks };
}
