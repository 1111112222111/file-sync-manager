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
  return d.toLocaleString('zh-CN');
}

export const CloudBrowser: React.FC = () => {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const api = useElectronAPI();

  const loadFiles = useCallback(async () => {
    if (!api) return;
    setLoading(true);
    try {
      const list = await api.cloudListFiles('/apps/我的同步文件');
      setFiles(list);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const handleDownload = async (file: FileInfo) => {
    if (!api) return;
    const savePath = `/downloads/${file.name}`; // 简化：生产环境用对话框
    await api.syncDownload(file.path, savePath);
  };

  const handleDelete = async (file: FileInfo) => {
    if (!api) return;
    try {
      await api.cloudDeleteFile(file.path);
      setFiles((prev) => prev.filter((f) => f.path !== file.path));
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

      <div
        style={{
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--card-radius)',
          border: '1px solid var(--border-subtle)',
          overflow: 'auto',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <th style={thStyle}>文件名</th>
              <th style={thStyle}>大小</th>
              <th style={thStyle}>修改时间</th>
              <th style={thStyle}>操作</th>
            </tr>
          </thead>
          <tbody>
            {files.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                  {loading ? '加载中...' : '暂无文件'}
                </td>
              </tr>
            ) : (
              files.map((f) => (
                <tr
                  key={f.path}
                  style={{ borderBottom: '1px solid var(--border-subtle)' }}
                >
                  <td style={tdStyle}>{f.isDir ? `[目录] ${f.name}` : f.name}</td>
                  <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>{f.isDir ? '-' : formatSize(f.size)}</td>
                  <td style={{ ...tdStyle, color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>{formatTime(f.mtime)}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      {!f.isDir && (
                        <Button size="sm" variant="secondary" onClick={() => handleDownload(f)}>下载</Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(f)}>删除</Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const thStyle: React.CSSProperties = {
  padding: 'var(--space-2) var(--table-cell-padding-x)',
  textAlign: 'left',
  fontSize: 'var(--text-sm)',
  fontWeight: 'var(--font-semibold)',
  color: 'var(--text-secondary)',
  height: 'var(--table-header-height)',
};

const tdStyle: React.CSSProperties = {
  padding: 'var(--space-2) var(--table-cell-padding-x)',
  fontSize: 'var(--text-base)',
  color: 'var(--text-primary)',
  height: 'var(--table-row-height)',
};
