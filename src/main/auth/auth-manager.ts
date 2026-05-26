/**
 * src/main/auth/auth-manager.ts — OAuth 授权管理
 */
import type { AuthStatus, BaiduToken } from '../../shared/types';

export class AuthManager {
  private token: BaiduToken | null = null;

  onStatusChanged?: (status: AuthStatus) => void;

  getStatus(): AuthStatus {
    const isAuthorized = this.token != null && this.token.expiresAt > Date.now();
    return {
      isAuthorized,
      expiresAt: this.token?.expiresAt ?? null,
    };
  }

  setToken(token: BaiduToken): void {
    this.token = token;
    this.onStatusChanged?.(this.getStatus());
  }

  logout(): void {
    this.token = null;
    this.onStatusChanged?.(this.getStatus());
  }
}
