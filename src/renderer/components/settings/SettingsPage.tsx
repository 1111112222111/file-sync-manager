/** SettingsPage 组件 — 设置页 */
import React, { useState, useEffect, useCallback } from 'react';
import { useElectronAPI } from '../../hooks/useIpc';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { ToggleSwitch } from '../common/ToggleSwitch';
import type { AppConfig, AuthStatus, FileInfo } from '../../../shared/types';

export const SettingsPage: React.FC = () => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [newFilterPattern, setNewFilterPattern] = useState('');
  const [editingPath, setEditingPath] = useState('');
  const [dirSuggestions, setDirSuggestions] = useState<FileInfo[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const api = useElectronAPI();

  const loadConfig = useCallback(async () => {
    if (!api) {
      setError('electronAPI 未加载，preload 脚本可能执行失败');
      return;
    }
    try {
      const cfg = await api.configGetAll();
      const status = await api.authGetStatus();
      setConfig(cfg);
      setAuthStatus(status);
      setError(null);
    } catch (err: any) {
      setError(`加载配置失败: ${err.message ?? '未知错误'}`);
    }
  }, [api]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  // 加载云端已有目录作为建议
  useEffect(() => {
    if (!api || !config || !authStatus?.isAuthorized) return;
    api.cloudListFiles('/').then((list) => {
      setDirSuggestions(list.filter((f: FileInfo) => f.isDir));
    }).catch(() => {});
  }, [api, config, authStatus?.isAuthorized]);

  const handleSetNotification = async (level: string) => {
    if (!api) return;
    await api.configSet('notificationLevel', level);
    setConfig((prev) => prev ? { ...prev, notificationLevel: level as any } : prev);
  };

  const handleSavePath = async () => {
    if (!api || !editingPath.trim()) return;
    await api.configSet('remoteRootPath', editingPath.trim());
    setConfig((prev) => prev ? { ...prev, remoteRootPath: editingPath.trim() } : prev);
    setMessage('路径已更新！');
    setTimeout(() => setMessage(null), 2000);
  };

  const handleAddFilter = async () => {
    if (!api || !newFilterPattern.trim()) return;
    const rule = await api.configAddFilterRule(newFilterPattern.trim());
    setConfig((prev) => prev ? { ...prev, filterRules: [...prev.filterRules, rule] } : prev);
    setNewFilterPattern('');
  };

  const handleRemoveFilter = async (id: string) => {
    if (!api) return;
    await api.configRemoveFilterRule(id);
    setConfig((prev) => prev ? { ...prev, filterRules: prev.filterRules.filter((r) => r.id !== id) } : prev);
  };

  const handleAuth = async () => {
    if (!api) return;
    setAuthLoading(true);
    setMessage(null);
    try {
      const result = await api.authStartOAuth();
      if (!result.success) {
        setError(result.error ?? '授权启动失败');
      } else {
        setMessage('授权成功！正在刷新状态...');
        await loadConfig();
        setMessage('授权成功！');
      }
    } catch (err: any) {
      setError(`授权调用失败: ${err.message ?? '未知错误'}`);
    } finally {
      setAuthLoading(false);
    }
  };
  const handleLogout = async () => {
    if (!api) return;
    await api.authLogout();
    await loadConfig();
  };

  if (error) {
    return (
      <div style={{ padding: 'var(--space-4)' }}>
        <p style={{ color: 'var(--status-error)', marginBottom: 'var(--space-3)' }}>{error}</p>
        <Button size="sm" variant="secondary" onClick={() => { setError(null); loadConfig(); }}>重试</Button>
      </div>
    );
  }

  if (!config) {
    return <p style={{ color: 'var(--text-tertiary)', padding: 'var(--space-4)' }}>加载配置中...</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', color: 'var(--text-primary)' }}>
        设置
      </h2>

      {/* 网盘授权 */}
      <Section title="百度网盘 OAuth 授权">
        {message && (
          <p style={{
            color: 'var(--status-success)', fontSize: 'var(--text-sm)',
            marginBottom: 'var(--space-2)', padding: 'var(--space-2)',
            background: 'var(--bg-success-muted)', borderRadius: 'var(--radius-sm)',
          }}>{message}</p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <span style={{
            width: 8, height: 8, borderRadius: 'var(--radius-full)',
            background: authStatus?.isAuthorized ? 'var(--status-success)' : 'var(--status-error)',
          }} />
          <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', flex: 1 }}>
            {authStatus?.isAuthorized
              ? `已登录${authStatus.userName ? ` — ${authStatus.userName}` : ''}`
              : '未授权'}
          </span>
          {authStatus?.isAuthorized
            ? <Button size="sm" variant="secondary" onClick={handleLogout}>登出</Button>
            : <Button size="sm" variant="primary" onClick={handleAuth} disabled={authLoading}>
                {authLoading ? '正在打开浏览器...' : '授权百度网盘'}
              </Button>
          }
        </div>
      </Section>

      {/* 上传目录 */}
      <Section title="远程上传目录">
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            <input
              value={editingPath || config.remoteRootPath}
              onChange={(e) => { setEditingPath(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="/我的同步文件"
              style={{
                flex: 1,
                height: 'var(--btn-height-sm)',
                padding: '0 var(--input-padding-x)',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)',
                outline: 'none',
                transition: 'var(--input-transition)',
                boxSizing: 'border-box',
              }}
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={handleSavePath}
              disabled={!editingPath.trim() || editingPath.trim() === config.remoteRootPath}
            >
              保存
            </Button>
          </div>

          {/* 已有目录建议下拉 */}
          {showSuggestions && dirSuggestions.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 56, zIndex: 10,
              maxHeight: 140, overflow: 'auto',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              marginTop: 2,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}>
              {/* 新建目录选项 */}
              {editingPath.trim() && !dirSuggestions.some((d) => d.path === editingPath.trim()) && (
                <div
                  onMouseDown={() => { setEditingPath(editingPath.trim()); setShowSuggestions(false); }}
                  style={{
                    padding: 'var(--space-2) var(--space-3)',
                    cursor: 'pointer',
                    color: 'var(--accent-primary)',
                    fontSize: 'var(--text-sm)',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  新建目录: {editingPath.trim()}
                </div>
              )}
              {dirSuggestions.map((dir) => (
                <div
                  key={dir.path}
                  onMouseDown={() => { setEditingPath(dir.path); setShowSuggestions(false); }}
                  style={{
                    padding: 'var(--space-2) var(--space-3)',
                    cursor: 'pointer',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--text-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                  }}
                  onMouseEnter={(e) => { (e.target as HTMLElement).style.background = 'var(--bg-secondary)'; }}
                  onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'transparent'; }}
                >
                  <span style={{ opacity: 0.6, fontSize: 14 }}>{'\u{1F4C1}'}</span>
                  <span style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}>{dir.path}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', marginTop: 'var(--space-1)' }}>
          文件将上传到百度网盘中的此目录
        </p>
      </Section>

      {/* 开机自启 */}
      <Section title="开机自启">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>系统启动时自动运行</span>
          <ToggleSwitch
            checked={config.autoLaunch ?? false}
            onChange={async (checked) => {
              if (!api) return;
              await api.configSet('autoLaunch', checked);
              setConfig((prev) => prev ? { ...prev, autoLaunch: checked } : prev);
            }}
          />
        </div>
      </Section>

      {/* 通知 */}
      <Section title="通知">
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          {(['all', 'error_only', 'off'] as const).map((l) => (
            <Button
              key={l}
              size="sm"
              variant={config.notificationLevel === l ? 'primary' : 'secondary'}
              onClick={() => handleSetNotification(l)}
            >
              {l === 'all' ? '全部' : l === 'error_only' ? '仅错误' : '关闭'}
            </Button>
          ))}
        </div>
      </Section>

      {/* 过滤规则 */}
      <Section title="过滤规则">
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
          <Input
            value={newFilterPattern}
            onChange={(e) => setNewFilterPattern(e.target.value)}
            placeholder="例如: *.tmp, node_modules"
            style={{ flex: 1 }}
          />
          <Button size="sm" variant="secondary" onClick={handleAddFilter}>添加</Button>
        </div>
        {config.filterRules.length === 0 ? (
          <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>暂无过滤规则</p>
        ) : (
          config.filterRules.map((rule) => (
            <div key={rule.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: 'var(--space-2) 0', borderBottom: '1px solid var(--border-subtle)',
            }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)' }}>
                {rule.pattern}
              </span>
              <Button size="sm" variant="ghost" onClick={() => handleRemoveFilter(rule.id)}>移除</Button>
            </div>
          ))
        )}
      </Section>
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
    <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-medium)', color: 'var(--text-secondary)' }}>
      {title}
    </h3>
    <div style={{ padding: 'var(--space-3)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
      {children}
    </div>
  </div>
);
