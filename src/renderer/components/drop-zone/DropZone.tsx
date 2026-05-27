/** DropZone 组件 — 拖拽上传区域 */
import React, { useState, useCallback, useRef, useEffect, DragEvent } from 'react';
import { useElectronAPI } from '../../hooks/useIpc';

export const DropZone: React.FC = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [dropFeedback, setDropFeedback] = useState<string | null>(null);
  const api = useElectronAPI();
  const counterRef = useRef(0);

  useEffect(() => {
    if (api) {
      api.authGetStatus().then((status) => {
        setIsAuthorized(status.isAuthorized);
      }).catch(() => {
        setIsAuthorized(false);
      });
    }
  }, [api]);

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    counterRef.current++;
    if (e.dataTransfer.items.length > 0) setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    counterRef.current--;
    if (counterRef.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    counterRef.current = 0;

    const files = Array.from(e.dataTransfer.files).map((f) => (f as any).path ?? f.name);
    if (files.length > 0 && api && isAuthorized) {
      const count = files.length;
      setDropFeedback(`已添加 ${count} 个文件到上传队列`);
      api.syncUpload(files);
      setTimeout(() => setDropFeedback(null), 2000);
    }
  }, [api, isAuthorized]);

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{
        minHeight: 'var(--dropzone-min-height)',
        padding: 'var(--dropzone-padding)',
        border: `${'var(--dropzone-border-width)'} dashed ${isDragging ? 'var(--accent-primary)' : dropFeedback ? 'var(--status-success)' : 'var(--border-default)'}`,
        borderRadius: 'var(--radius-lg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-3)',
        background: isDragging ? 'var(--accent-primary-muted)' : dropFeedback ? 'var(--bg-success-muted)' : 'var(--bg-secondary)',
        transition: `all var(--duration-fast) var(--ease-default)`,
        color: 'var(--text-secondary)',
        fontSize: 'var(--text-base)',
        cursor: 'default',
        userSelect: 'none',
      }}
    >
      {!isAuthorized ? (
        <p style={{ color: 'var(--status-warning)', fontWeight: 'var(--font-medium)' }}>
          请先在设置中授权百度网盘
        </p>
      ) : dropFeedback ? (
        <p style={{ color: 'var(--status-success)', fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)' }}>
          {dropFeedback}
        </p>
      ) : isDragging ? (
        <p style={{ color: 'var(--accent-primary)', fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)' }}>
          释放鼠标以上传文件
        </p>
      ) : (
        <p>拖拽文件或文件夹到此处上传到百度网盘</p>
      )}
    </div>
  );
};
