/**
 * src/main/config/config-store.test.ts
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigStore } from './config-store';
import type { AppConfig } from '../../shared/types';

describe('ConfigStore', () => {
  let store: ConfigStore;

  beforeEach(() => {
    store = new ConfigStore();
  });

  describe('getAll', () => {
    it('应返回默认配置', () => {
      const config: AppConfig = store.getAll();
      expect(config.theme).toBe('dark');
      expect(config.notificationLevel).toBe('all');
      expect(config.autoLaunch).toBe(false);
      expect(config.filterRules).toHaveLength(0);
      expect(config.baiduToken).toBeNull();
    });
  });

  describe('set / get', () => {
    it('应持久化并读取单个配置项', () => {
      store.set('theme', 'light');
      expect(store.getAll().theme).toBe('light');
    });

    it('应持久化通知级别', () => {
      store.set('notificationLevel', 'error_only');
      expect(store.getAll().notificationLevel).toBe('error_only');
    });

    it('应持久化自动启动', () => {
      store.set('autoLaunch', true);
      expect(store.getAll().autoLaunch).toBe(true);
    });

    it('应持久化远程根路径', () => {
      store.set('remoteRootPath', '/我的备份');
      expect(store.getAll().remoteRootPath).toBe('/我的备份');
    });
  });

  describe('addFilterRule / removeFilterRule', () => {
    it('添加过滤规则后应出现在配置中', () => {
      store.addFilterRule('*.tmp');
      const rules = store.getAll().filterRules;
      expect(rules).toHaveLength(1);
      expect(rules[0].pattern).toBe('*.tmp');
    });

    it('移除过滤规则后应消失', () => {
      const rule = store.addFilterRule('*.tmp');
      store.removeFilterRule(rule.id);
      expect(store.getAll().filterRules).toHaveLength(0);
    });
  });

  describe('setToken', () => {
    it('应存储 OAuth token', () => {
      store.setToken({
        accessToken: 'at-123',
        refreshToken: 'rt-456',
        expiresAt: 1716912000000,
      });

      const token = store.getAll().baiduToken;
      expect(token).not.toBeNull();
      expect(token!.accessToken).toBe('at-123');
    });
  });
});
