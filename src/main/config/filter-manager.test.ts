/**
 * src/main/config/filter-manager.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FilterManager } from './filter-manager';
import type { FilterRule } from '../../shared/types';

describe('FilterManager', () => {
  let manager: FilterManager;

  beforeEach(() => {
    manager = new FilterManager();
  });

  describe('addRule', () => {
    it('应添加过滤规则并返回唯一 id', () => {
      const rule: FilterRule = manager.addRule('*.tmp', true);
      expect(rule.id).toBeDefined();
      expect(rule.pattern).toBe('*.tmp');
      expect(rule.enabled).toBe(true);
    });

    it('应支持添加禁用状态规则', () => {
      const rule: FilterRule = manager.addRule('*.bak', false);
      expect(rule.enabled).toBe(false);
    });
  });

  describe('removeRule', () => {
    it('应移除指定 id 的规则', () => {
      const rule = manager.addRule('*.tmp', true);
      const removed = manager.removeRule(rule.id);

      expect(removed).toBe(true);
      expect(manager.getRules()).toHaveLength(0);
    });

    it('移除不存在的规则应返回 false', () => {
      const removed = manager.removeRule('nonexistent-id');
      expect(removed).toBe(false);
    });
  });

  describe('getRules', () => {
    it('应返回所有规则（包括禁用的）', () => {
      manager.addRule('*.tmp', true);
      manager.addRule('*.bak', false);

      expect(manager.getRules()).toHaveLength(2);
    });

    it('初始状态应返回空数组', () => {
      expect(manager.getRules()).toHaveLength(0);
    });
  });

  describe('check / shouldExclude', () => {
    it('精确匹配文件名', () => {
      manager.addRule('Thumbs.db', true);
      expect(manager.shouldExclude('C:\\Users\\test\\Thumbs.db')).toBe(true);
      expect(manager.shouldExclude('C:\\Users\\test\\other.db')).toBe(false);
    });

    it('通配符 * 匹配任意字符', () => {
      manager.addRule('*.tmp', true);
      expect(manager.shouldExclude('data.tmp')).toBe(true);
      expect(manager.shouldExclude('subdir/file.tmp')).toBe(true);
      expect(manager.shouldExclude('data.txt')).toBe(false);
    });

    it('通配符 ? 匹配单个字符', () => {
      manager.addRule('file-?.txt', true);
      expect(manager.shouldExclude('file-a.txt')).toBe(true);
      expect(manager.shouldExclude('file-ab.txt')).toBe(false);
    });

    it('应匹配路径中的中间目录', () => {
      manager.addRule('node_modules', true);
      expect(manager.shouldExclude('C:\\project\\node_modules\\package.json')).toBe(true);
      expect(manager.shouldExclude('C:\\project\\src\\index.ts')).toBe(false);
    });

    it('禁用的规则应不作为过滤条件', () => {
      manager.addRule('*.tmp', false); // 禁用
      expect(manager.shouldExclude('data.tmp')).toBe(false);
    });

    it('多条规则中任一条匹配即排除', () => {
      manager.addRule('*.tmp', true);
      manager.addRule('*.bak', true);
      manager.addRule('*.log', true);

      expect(manager.shouldExclude('data.bak')).toBe(true);
      expect(manager.shouldExclude('data.log')).toBe(true);
      expect(manager.shouldExclude('data.txt')).toBe(false);
    });

    it('支持匹配模式中的 ? 通配符', () => {
      manager.addRule('temp-?.dat', true);
      expect(manager.shouldExclude('temp-1.dat')).toBe(true);
      expect(manager.shouldExclude('temp-12.dat')).toBe(false);
    });
  });
});
