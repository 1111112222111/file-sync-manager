/**
 * src/renderer/App.tsx — 便签风格布局
 */
import React, { useState, useCallback } from 'react';
import { useTheme } from './hooks/useTheme';
import { SunIcon, MoonIcon, MinimizeIcon, CloseIcon } from './components/common/Icons';
import { DropZone } from './components/drop-zone/DropZone';
import { TransferPanel } from './components/transfer-panel/TransferPanel';
import { CloudBrowser } from './components/cloud-browser/CloudBrowser';
import { WatchSourcePanel } from './components/watch-sources/WatchSourcePanel';
import { SettingsPage } from './components/settings/SettingsPage';
import { ConflictDialog } from './components/conflict/ConflictDialog';
import type { ConflictInfo, ConflictChoice } from '../shared/types';

type NavTab = 'transfer' | 'cloud' | 'watch' | 'settings';

const NAV_ITEMS: { id: NavTab; label: string }[] = [
  { id: 'transfer', label: '传输' },
  { id: 'cloud', label: '云端' },
  { id: 'watch', label: '监听' },
  { id: 'settings', label: '设置' },
];

const App: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<NavTab>('transfer');
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => { if (theme === 'system') setTheme('system'); };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme, setTheme]);

  const handleConflictResolve = (_taskId: string, _choice: ConflictChoice) => {
    setConflict(null);
  };

  const handleClose = useCallback(() => {
    const api = (window as any).electronAPI;
    api?.windowClose?.();
  }, []);

  const handleMinimize = useCallback(() => {
    const api = (window as any).electronAPI;
    api?.windowMinimize?.();
  }, []);

  return (
    <div style={appStyle}>
      {/* 无边框标题栏 */}
      <header style={titleBarStyle} className="drag-region">
        <span style={titleStyle}>文件同步</span>
        <div style={windowControlsStyle}>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            style={controlBtnStyle}
            title="切换主题"
          >
            {theme === 'dark' ? <SunIcon size={14} /> : <MoonIcon size={14} />}
          </button>
          <button onClick={handleMinimize} style={controlBtnStyle}><MinimizeIcon size={14} /></button>
          <button onClick={handleClose} style={{ ...controlBtnStyle, color: 'var(--status-error)' }}><CloseIcon size={14} color="var(--status-error)" /></button>
        </div>
      </header>

      {/* 导航 */}
      <nav style={navStyle}>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            style={{
              ...navBtnStyle,
              background: activeTab === item.id ? 'var(--accent-primary-muted)' : 'transparent',
              color: activeTab === item.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* 内容区 */}
      <main style={mainStyle}>
        {activeTab === 'transfer' && (
          <>
            <DropZone />
            <div style={{ height: 8 }} />
            <TransferPanel />
          </>
        )}
        {activeTab === 'cloud' && <CloudBrowser />}
        {activeTab === 'watch' && <WatchSourcePanel />}
        {activeTab === 'settings' && <SettingsPage />}
      </main>

      {/* 冲突弹窗 */}
      <ConflictDialog conflict={conflict} onResolve={handleConflictResolve} />
    </div>
  );
};

// ─── 样式 ───

const appStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  backgroundColor: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-sans)',
  fontSize: 'var(--text-sm)',
  borderRadius: '8px',
  overflow: 'hidden',
};

const titleBarStyle: React.CSSProperties = {
  height: 32,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 8px 0 12px',
  backgroundColor: 'var(--bg-elevated)',
  flexShrink: 0,
  WebkitAppRegion: 'drag',
  userSelect: 'none',
};

const titleStyle: React.CSSProperties = {
  fontSize: 'var(--text-xs)',
  fontWeight: 'var(--font-semibold)',
  color: 'var(--text-tertiary)',
};

const windowControlsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 2,
  WebkitAppRegion: 'no-drag',
};

const controlBtnStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: 'var(--text-secondary)',
  fontSize: 'var(--text-sm)',
  width: 28,
  height: 24,
  cursor: 'pointer',
  borderRadius: 'var(--radius-sm)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 1,
};

const navStyle: React.CSSProperties = {
  display: 'flex',
  gap: 2,
  padding: '4px 8px',
  backgroundColor: 'var(--bg-elevated)',
  borderBottom: '1px solid var(--border-subtle)',
  flexShrink: 0,
};

const navBtnStyle: React.CSSProperties = {
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  padding: '4px 10px',
  fontSize: 'var(--text-xs)',
  fontWeight: 'var(--font-medium)',
  cursor: 'pointer',
  transition: 'all var(--duration-fast) var(--ease-default)',
};

const mainStyle: React.CSSProperties = {
  flex: 1,
  padding: 'var(--space-3)',
  overflow: 'auto',
};

export default App;
