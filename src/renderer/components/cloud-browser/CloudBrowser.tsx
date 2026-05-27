/** CloudBrowser 组件 — 云端文件浏览器 */
import React, { useState, useEffect, useCallback } from 'react';
import { useElectronAPI } from '../../hooks/useIpc';
import { Button } from '../common/Button';
import type { FileInfo } from '../../../shared/types';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatTime(ts: number): string {
  const d = new Date(ts * 1000);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hours}:${mins}`;
}

export const CloudBrowser: React.FC = () => {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [remoteRoot, setRemoteRoot] = useState('/我的同步文件');
  const [downloading, setDownloading] = useState<string | null>(null);
  const api = useElectronAPI();

  const loadFiles = useCallback(async () => {
    if (!api) return;
    setLoading(true);
    try {
      const list = await api.cloudListFiles(remoteRoot);
      setFiles(list);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [api, remoteRoot]);

  useEffect(() => {
    if (api) {
      api.configGetAll().then((cfg) => {
        setRemoteRoot(cfg.remoteRootPath ?? '/我的同步文件');
      });
    }
  }, [api]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const handleDownload = async (file: FileInfo) => {
    if (!api) return;
    setDownloading(file.path);
    try {
      const savePath = await api.dialogSaveFile(file.name);
      if (!savePath) { setDownloading(null); return; }
      await api.syncDownload(file.path, savePath);
    } catch {
      // ignore
    } finally {
      setDownloading(null);
    }
  };

  const handleDelete = async (file: FileInfo) => {
    if (!api) return;
    try {
      const result = await api.cloudDeleteFile(file.path);
      if (result.success) {
        setFiles((prev) => prev.filter((f) => f.path !== file.path));
      }
    } catch {
      // ignore
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)' }}>
          云端文件
        </h2>
        <Button size="sm" variant="secondary" onClick={loadFiles} disabled={loading}>
          {loading ? '加载中...' : '刷新'}
        </Button>
      </div>

      {files.length === 0 ? (
        <p style={{ color: 'var(--text-tertiary)', padding: 'var(--space-8) 0', textAlign: 'center' }}>
          {loading ? '加载中...' : '暂无文件'}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {files.map((f) => (
            <div
              key={f.path}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-2) var(--space-3)',
                background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {/* 文件图标 */}
              <span style={{
                fontSize: 16, flexShrink: 0, opacity: 0.7,
                lineHeight: 1,
              }}>
                {f.isDir ? '\u{1F4C1}' : '\u{1F4C4}'}
              </span>

              {/* 文件名 + 元信息 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--font-medium)',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  wordBreak: 'break-all',
                  lineHeight: 1.35,
                }} title={f.name}>
                  {f.name}
                </div>
                <div style={{
                  color: 'var(--text-tertiary)',
                  fontSize: 'var(--text-xs)',
                  marginTop: 2,
                  display: 'flex',
                  gap: 'var(--space-2)',
                }}>
                  <span>{f.isDir ? '-' : formatSize(f.size)}</span>
                  <span>{formatTime(f.mtime)}</span>
                </div>
              </div>

              {/* 操作按钮 */}
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                {!f.isDir && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleDownload(f)}
                    disabled={downloading === f.path}
                  >
                    {downloading === f.path ? '...' : '下载'}
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => handleDelete(f)}>删除</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
