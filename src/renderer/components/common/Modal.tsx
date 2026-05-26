/** Modal 组件 */
import React, { useEffect } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  width?: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ open, onClose, title, width, children }) => {
  useEffect(() => {
    if (open) {
      const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--z-modal)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* 遮罩 */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--surface-overlay)',
          zIndex: 'var(--z-modal-backdrop)',
        }}
      />
      {/* 弹窗 */}
      <div
        style={{
          position: 'relative',
          zIndex: 'var(--z-modal)',
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--card-radius)',
          width: width ?? 'var(--modal-width-md)',
          maxWidth: '90vw',
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        {title && (
          <div
            style={{
              padding: 'var(--card-padding)',
              borderBottom: '1px solid var(--border-subtle)',
              fontSize: 'var(--text-lg)',
              fontWeight: 'var(--font-semibold)',
              color: 'var(--text-primary)',
            }}
          >
            {title}
          </div>
        )}
        <div style={{ padding: 'var(--modal-padding)' }}>{children}</div>
      </div>
    </div>
  );
};
