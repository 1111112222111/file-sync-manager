/**
 * src/renderer/hooks/useIpc.ts — IPC 通信 hook
 */
import { useCallback, useEffect, useRef } from 'react';
import type { ElectronAPI } from '../types/ipc';

function getAPI(): ElectronAPI | undefined {
  return (window as any).electronAPI;
}

/** 获取 electronAPI 的 hook（开发环境提供 fallback） */
export function useElectronAPI(): ElectronAPI | undefined {
  return getAPI();
}

/** 监听主进程事件的 hook */
export function useIpcEvent(
  channel: string,
  callback: (...args: any[]) => void,
): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const api = getAPI();
    if (!api) return;

    const handler = (...args: any[]) => callbackRef.current(...args);
    api.on(channel, handler);
    return () => {
      api.removeListener(channel, handler);
    };
  }, [channel]);
}

/** 调用主进程方法的 hook */
export function useIpcInvoke<T extends (...args: any[]) => Promise<any>>(
  methodName: string,
): T | undefined {
  const api = getAPI();
  return api ? (api as any)[methodName] : undefined;
}
