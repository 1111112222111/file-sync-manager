/**
 * src/main/auth/auth-manager.ts — OAuth 授权管理
 *
 * 百度网盘 OAuth 2.0 授权流程：
 * 1. 用户百度开发者控制台获取 api_key + secret_key
 * 2. 应用打开浏览器 → 用户登录百度账号并授权
 * 3. 百度回调 localhost HTTP 服务器 → 应用获取 authorization code
 * 4. 应用用 code 换取 access_token + refresh_token
 *
 * 参考文档: https://pan.baidu.com/union/document/basic
 */
import * as http from 'http';
import * as crypto from 'crypto';
import type { AuthStatus, BaiduToken, BaiduApiCredentials } from '../../shared/types';

const BAIDU_OAUTH_AUTHORIZE = 'https://openapi.baidu.com/oauth/2.0/authorize';
const BAIDU_OAUTH_TOKEN = 'https://openapi.baidu.com/oauth/2.0/token';
const CALLBACK_PORT = 19199;

interface HttpRequestFn {
  (url: string, options?: { method?: string; headers?: Record<string, string>; body?: string }): Promise<{
    ok: boolean;
    json(): Promise<any>;
  }>;
}

export class AuthManager {
  private token: BaiduToken | null = null;
  private credentials: BaiduApiCredentials | null = null;
  private httpRequest: HttpRequestFn;

  onStatusChanged?: (status: AuthStatus) => void;

  constructor(httpRequest?: HttpRequestFn) {
    this.httpRequest = httpRequest ?? ((url, opts) =>
      fetch(url, { method: opts?.method, headers: opts?.headers, body: opts?.body })
    );
  }

  setCredentials(credentials: BaiduApiCredentials): void {
    this.credentials = credentials;
  }

  hasCredentials(): boolean {
    return this.credentials != null && this.credentials.apiKey !== '' && this.credentials.secretKey !== '';
  }

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

  getToken(): BaiduToken | null {
    return this.token;
  }

  /**
   * 发起 OAuth 授权流程
   * 打开浏览器让用户登录百度账号并授权，通过本地 HTTP 服务器接收回调
   */
  async startOAuth(): Promise<{ success: boolean; error?: string }> {
    if (!this.credentials) {
      return { success: false, error: '未配置百度网盘 API 凭证，请先设置 api_key 和 secret_key' };
    }

    const state = crypto.randomBytes(16).toString('hex');
    const redirectUri = `http://localhost:${CALLBACK_PORT}/callback`;

    return new Promise((resolve) => {
      // 启动临时 HTTP 服务器接收 OAuth 回调
      const server = http.createServer(async (req, res) => {
        try {
          const url = new URL(req.url ?? '/', `http://localhost:${CALLBACK_PORT}`);

          if (url.pathname === '/callback') {
            const code = url.searchParams.get('code');
            const returnedState = url.searchParams.get('state');
            const error = url.searchParams.get('error');

            if (error) {
              res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
              res.end(`<h2>授权失败</h2><p>${error}: ${url.searchParams.get('error_description') ?? ''}</p><p>请关闭此页面返回应用。</p>`);
              server.close();
              resolve({ success: false, error: url.searchParams.get('error_description') ?? error });
              return;
            }

            if (returnedState !== state) {
              res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
              res.end('<h2>授权失败</h2><p>state 不匹配，可能存在 CSRF 攻击。</p>');
              server.close();
              resolve({ success: false, error: 'OAuth state 不匹配' });
              return;
            }

            if (!code) {
              res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
              res.end('<h2>授权失败</h2><p>未收到授权码。</p>');
              server.close();
              resolve({ success: false, error: '未收到授权码' });
              return;
            }

            // 用授权码换取 token
            try {
              const tokenRes = await this.httpRequest(BAIDU_OAUTH_TOKEN, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                  grant_type: 'authorization_code',
                  code,
                  client_id: this.credentials!.apiKey,
                  client_secret: this.credentials!.secretKey,
                  redirect_uri: redirectUri,
                }).toString(),
              });

              const data = await tokenRes.json();

              if (!tokenRes.ok || data.error) {
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(`<h2>Token 交换失败</h2><p>${data.error_description ?? data.error ?? '未知错误'}</p>`);
                server.close();
                resolve({ success: false, error: data.error_description ?? 'Token 交换失败' });
                return;
              }

              this.token = {
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
                expiresAt: Date.now() + (data.expires_in ?? 2592000) * 1000,
              };

              this.onStatusChanged?.(this.getStatus());

              res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
              res.end('<h2>授权成功！</h2><p>百度网盘已授权，请关闭此页面返回应用。</p>');
              server.close();
              resolve({ success: true });
            } catch (err: any) {
              res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
              res.end(`<h2>Token 交换失败</h2><p>${err.message}</p>`);
              server.close();
              resolve({ success: false, error: err.message });
            }
          } else {
            res.writeHead(404);
            res.end('Not found');
          }
        } catch (err: any) {
          server.close();
          resolve({ success: false, error: err.message });
        }
      });

      server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          resolve({ success: false, error: `端口 ${CALLBACK_PORT} 已被占用，请稍后重试` });
        } else {
          resolve({ success: false, error: err.message });
        }
      });

      server.listen(CALLBACK_PORT, () => {
        const params = new URLSearchParams({
          response_type: 'code',
          client_id: this.credentials!.apiKey,
          redirect_uri: redirectUri,
          scope: 'basic,netdisk',
          state,
          display: 'page',
        });
        const authUrl = `${BAIDU_OAUTH_AUTHORIZE}?${params.toString()}`;

        // 打开系统默认浏览器
        const { shell } = require('electron');
        shell.openExternal(authUrl);
      });
    });
  }

  /** 刷新过期的 access_token */
  async refreshToken(): Promise<boolean> {
    if (!this.token?.refreshToken || !this.credentials) return false;

    try {
      const res = await this.httpRequest(BAIDU_OAUTH_TOKEN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.token.refreshToken,
          client_id: this.credentials.apiKey,
          client_secret: this.credentials.secretKey,
        }).toString(),
      });

      const data = await res.json();

      if (!res.ok || data.error) return false;

      this.token = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? this.token.refreshToken,
        expiresAt: Date.now() + (data.expires_in ?? 2592000) * 1000,
      };

      this.onStatusChanged?.(this.getStatus());
      return true;
    } catch {
      return false;
    }
  }

  logout(): void {
    this.token = null;
    this.onStatusChanged?.(this.getStatus());
  }
}
