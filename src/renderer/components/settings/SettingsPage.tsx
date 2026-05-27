/** SettingsPage 组件 — 设置页 */
import React, { useState, useEffect, useCallback } from 'react';
import { useElectronAPI } from '../../hooks/useIpc';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { ToggleSwitch } from '../common/ToggleSwitch';
import type { AppConfig, AuthStatus } from '../../../shared/types';

export const SettingsPage: React.FC = () => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [newFilterPattern, setNewFilterPattern] = useState('');
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

  const handleSetNotification = async (level: string) => {
    if (!api) return;
    await api.configSet('notificationLevel', level);
    setConfig((prev) => prev ? { ...prev, notificationLevel: level as any } : prev);
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
            {authStatus?.isAuthorized ? '已授权（Token 有效）' : '未授权'}
          </span>
          {authStatus?.isAuthorized
            ? <Button size="sm" variant="secondary" onClick={handleLogout}>登出</Button>
            : <Button size="sm" variant="primary" onClick={handleAuth} disabled={authLoading}>
                {authLoading ? '正在打开浏览器...' : '授权百度网盘'}
              </Button>
          }
        </div>
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
