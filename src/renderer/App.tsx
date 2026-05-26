/**
 * src/renderer/App.tsx — AppShell：布局框架 + 导航 + 主题
 */
import React, { useState } from 'react';
import { useTheme } from './hooks/useTheme';
import { DropZone } from './components/drop-zone/DropZone';
import { TransferPanel } from './components/transfer-panel/TransferPanel';
import { CloudBrowser } from './components/cloud-browser/CloudBrowser';
import { WatchSourcePanel } from './components/watch-sources/WatchSourcePanel';
import { SettingsPage } from './components/settings/SettingsPage';
import { ConflictDialog } from './components/conflict/ConflictDialog';
import type { ConflictInfo, ConflictChoice } from '../shared/types';

type NavTab = 'transfer' | 'cloud' | 'watch' | 'settings';

const NAV_ITEMS: { id: NavTab; label: string }[] = [
  { id: 'transfer', label: '传输任务' },
  { id: 'cloud', label: '云端浏览' },
  { id: 'watch', label: '监听源' },
  { id: 'settings', label: '设置' },
];

const App: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<NavTab>('transfer');
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);

  // 初始化主题
  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => { if (theme === 'system') setTheme('system'); };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme, setTheme]);

  const handleConflictResolve = (_taskId: string, _choice: ConflictChoice) => {
    // 简化：关闭弹窗（生产环境通过 IPC 通知主进程）
    setConflict(null);
  };

  return (
    <div style={appStyle}>
      {/* 导航栏 */}
      <header style={headerStyle}>
        <h1 style={titleStyle}>文件自动同步管理器</h1>
        <nav style={{ display: 'flex', gap: 'var(--space-1)' }}>
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
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          style={themeBtnStyle}
          title="切换主题"
        >
          {theme === 'dark' ? '浅色' : '深色'}
        </button>
      </header>

      {/* 内容区 */}
      <main style={mainStyle}>
        {activeTab === 'transfer' && (
          <>
            <DropZone />
            <div style={{ height: 'var(--space-4)' }} />
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

// ─── 样式（全部使用 CSS Token）───

const appStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  backgroundColor: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-sans)',
  fontSize: 'var(--text-base)',
};

const headerStyle: React.CSSProperties = {
  height: 'var(--navbar-height)',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-6)',
  padding: '0 var(--navbar-padding-x)',
  borderBottom: '1px solid var(--border-subtle)',
  backgroundColor: 'var(--bg-elevated)',
  flexShrink: 0,
};

const titleStyle: React.CSSProperties = {
  fontSize: 'var(--text-lg)',
  fontWeight: 'var(--font-semibold)',
  color: 'var(--text-primary)',
  whiteSpace: 'nowrap',
};

const navBtnStyle: React.CSSProperties = {
  border: 'none',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--space-1) var(--space-3)',
  fontSize: 'var(--text-sm)',
  fontWeight: 'var(--font-medium)',
  cursor: 'pointer',
  transition: 'all var(--duration-fast) var(--ease-default)',
};

const themeBtnStyle: React.CSSProperties = {
  marginLeft: 'auto',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--space-1) var(--space-3)',
  fontSize: 'var(--text-sm)',
  background: 'var(--bg-secondary)',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
};

const mainStyle: React.CSSProperties = {
  flex: 1,
  padding: 'var(--space-6)',
  overflow: 'auto',
};

export default App;
