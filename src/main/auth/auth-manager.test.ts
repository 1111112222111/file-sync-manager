/**
 * src/main/auth/auth-manager.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthManager } from './auth-manager';
import type { AuthStatus } from '../../shared/types';

describe('AuthManager', () => {
  let manager: AuthManager;

  beforeEach(() => {
    manager = new AuthManager();
  });

  describe('getStatus', () => {
    it('初始状态应为未授权', () => {
      const status: AuthStatus = manager.getStatus();
      expect(status.isAuthorized).toBe(false);
      expect(status.expiresAt).toBeNull();
    });
  });

  describe('setToken', () => {
    it('设置 token 后应变为已授权', () => {
      manager.setToken({
        accessToken: 'test-access',
        refreshToken: 'test-refresh',
        expiresAt: Date.now() + 3600000,
      });

      const status = manager.getStatus();
      expect(status.isAuthorized).toBe(true);
      expect(status.expiresAt).not.toBeNull();
    });

    it('设置过期 token 应仍为未授权', () => {
      manager.setToken({
        accessToken: 'expired',
        refreshToken: 'test-refresh',
        expiresAt: Date.now() - 1000, // 已过期
      });

      const status = manager.getStatus();
      expect(status.isAuthorized).toBe(false);
    });
  });

  describe('logout', () => {
    it('登出后应变为未授权', () => {
      manager.setToken({ accessToken: 'test', refreshToken: 'test', expiresAt: Date.now() + 3600000 });
      manager.logout();

      const status = manager.getStatus();
      expect(status.isAuthorized).toBe(false);
    });
  });

  describe('onStatusChanged', () => {
    it('token 状态变化时应触发回调', () => {
      const callback = vi.fn();
      manager.onStatusChanged = callback;

      manager.setToken({ accessToken: 'test', refreshToken: 'test', expiresAt: Date.now() + 3600000 });

      expect(callback).toHaveBeenCalled();
    });
  });
});
