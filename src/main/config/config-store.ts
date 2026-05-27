/**
 * src/main/config/config-store.ts — 应用配置读写
 *
 * 内存存储实现（生产环境替换为 electron-store 加密存储）
 */
import { v4 as uuidv4 } from 'uuid';
import type { AppConfig, BaiduToken, BaiduApiCredentials, FilterRule, NotificationLevel, ThemeMode } from '../../shared/types';

const DEFAULT_CONFIG: AppConfig = {
  baiduToken: null,
  baiduCredentials: null,
  remoteRootPath: '/我的同步文件',
  notificationLevel: 'all',
  theme: 'dark',
  autoLaunch: false,
  filterRules: [],
};

export class ConfigStore {
  private config: AppConfig = { ...DEFAULT_CONFIG, filterRules: [] };

  getAll(): AppConfig {
    return { ...this.config, filterRules: [...this.config.filterRules] };
  }

  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    (this.config as any)[key] = value;
  }

  addFilterRule(pattern: string): FilterRule {
    const rule: FilterRule = { id: uuidv4(), pattern, enabled: true };
    this.config.filterRules.push(rule);
    return rule;
  }

  removeFilterRule(id: string): boolean {
    const idx = this.config.filterRules.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    this.config.filterRules.splice(idx, 1);
    return true;
  }

  setToken(token: BaiduToken): void {
    this.config.baiduToken = token;
  }
}
