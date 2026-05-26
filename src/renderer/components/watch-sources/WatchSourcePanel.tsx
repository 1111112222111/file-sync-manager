/** WatchSourcePanel 组件 — 监听源管理 */
import React, { useState, useEffect, useCallback } from 'react';
import { useElectronAPI } from '../../hooks/useIpc';
import { Button } from '../common/Button';
import type { WatchSource } from '../../../shared/types';

export const WatchSourcePanel: React.FC = () => {
  const [sources, setSources] = useState<WatchSource[]>([]);
  const [adding, setAdding] = useState(false);
  const api = useElectronAPI();

  const loadSources = useCallback(async () => {
    if (!api) return;
    const list = await api.watcherGetSources();
    setSources(list);
  }, [api]);

  useEffect(() => { loadSources(); }, [loadSources]);

  const handleAdd = async () => {
    if (!api) return;
    setAdding(true);
    try {
      // 简化：生产环境调用系统文件夹选择对话框
      const source = await api.watcherAddSource('C:\\Users\\Default\\Documents\\Test');
      setSources((prev) => [...prev, source]);
    } catch {
      // ignore
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (id: string) => {
    if (!api) return;
    await api.watcherRemoveSource(id);
    setSources((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)' }}>
          监听源 ({sources.length})
        </h2>
        <Button size="sm" variant="secondary" onClick={handleAdd} disabled={adding}>
          {adding ? '添加中...' : '添加文件夹'}
        </Button>
      </div>

      {sources.length === 0 ? (
        <p style={{ color: 'var(--text-tertiary)', padding: 'var(--space-8)', textAlign: 'center' }}>
          暂无监听源，点击"添加文件夹"开始监听
        </p>
      ) : (
        sources.map((source) => (
          <div
            key={source.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 'var(--space-3) var(--space-4)',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flex: 1, minWidth: 0 }}>
              <span style={{
                width: 8, height: 8, borderRadius: 'var(--radius-full)',
                background: source.status === 'active' ? 'var(--status-success)'
                  : source.status === 'error' ? 'var(--status-error)' : 'var(--status-paused)',
                flexShrink: 0,
              }} />
              <span style={{ color: 'var(--text-primary)', fontSize: 'var(--text-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {source.localPath}
              </span>
            </div>
            <Button size="sm" variant="ghost" onClick={() => handleRemove(source.id)}>移除</Button>
          </div>
        ))
      )}
    </div>
  );
};
