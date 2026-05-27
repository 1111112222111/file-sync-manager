/**
 * src/main/cloud/baidu-pan.adapter.ts — 百度网盘适配器
 *
 * 实现 ICloudAdapter 接口，封装百度网盘 Open API 调用。
 * 通过构造函数注入 HTTP 请求函数以支持测试。
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ICloudAdapter } from './adapter.interface';
import type {
  FileInfo,
  UploadResult,
  DownloadResult,
  DeleteResult,
  QuotaInfo,
  ProgressCallback,
} from '../../shared/types';

/** HTTP 请求函数类型（便于测试时 mock） */
type HttpRequest = (url: string, options?: RequestInit) => Promise<Response>;

/** BaiduPanAdapter 构造参数 */
interface BaiduPanOptions {
  accessToken: string;
  remoteRoot: string;
  httpRequest?: HttpRequest;
}

/** 百度网盘 API 基础 URL */
const PAN_BASE_URL = 'https://pan.baidu.com';

export class BaiduPanAdapter implements ICloudAdapter {
  private accessToken: string;
  private readonly remoteRoot: string;
  private readonly http: HttpRequest;

  constructor(options: BaiduPanOptions) {
    this.accessToken = options.accessToken;
    this.remoteRoot = options.remoteRoot.replace(/\/+$/, '');
    this.http = options.httpRequest ?? fetch;
  }

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  /** 拼接带 access_token 的 URL */
  private url(endpoint: string, params: Record<string, string> = {}): string {
    const searchParams = new URLSearchParams(params);
    searchParams.set('access_token', this.accessToken);
    return `${PAN_BASE_URL}${endpoint}?${searchParams.toString()}`;
  }

  /** 从远程路径提取文件名 */
  private getFileName(remotePath: string): string {
    return remotePath.split('/').filter(Boolean).pop() ?? remotePath;
  }

  // ─── upload ──────────────────────────────────────────────

  async upload(
    localPath: string,
    remotePath: string,
    onProgress?: ProgressCallback,
  ): Promise<UploadResult> {
    try {
      const fileSize = fs.statSync(localPath).size;
      const fileBuffer = fs.readFileSync(localPath);

      if (onProgress) onProgress(30, 0, 0);

      // 简单上传：method=upload，body 为 multipart/form-data
      const boundary = `----BaiduPanUpload${Date.now()}${Math.random().toString(36).slice(2)}`;
      const crlf = '\r\n';
      const header = [
        `--${boundary}`,
        `Content-Disposition: form-data; name="file"; filename="${encodeURIComponent(this.getFileName(remotePath))}"`,
        `Content-Type: application/octet-stream`,
        '',
        '',
      ].join(crlf);
      const footer = `${crlf}--${boundary}--`;
      const headerBytes = Buffer.from(header, 'utf-8');
      const footerBytes = Buffer.from(footer, 'utf-8');
      const body = Buffer.concat([headerBytes, fileBuffer, footerBytes]);

      const uploadUrl = this.url('/rest/2.0/xpan/file', {
        method: 'upload',
        path: remotePath,
        ondup: 'overwrite',
      });

      const uploadRes = await this.http(uploadUrl, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': String(body.length),
        },
        body: new Uint8Array(body),
      });

      if (onProgress) onProgress(90, 0, 0);

      const uploadData = await uploadRes.json();
      console.log('[BaiduPan upload] response:', JSON.stringify(uploadData));

      const errno = uploadData.errno ?? uploadData.error_code ?? 0;
      if (!uploadRes.ok || errno !== 0) {
        const errMsg = uploadData.errmsg ?? uploadData.error_msg ?? uploadData.error ?? `errno=${errno}`;
        console.error('[BaiduPan upload] failed:', errMsg, '| full:', JSON.stringify(uploadData));
        return { success: false, remotePath, size: 0, error: `上传失败: ${errMsg}` };
      }

      if (onProgress) onProgress(100, 0, 0);

      return { success: true, remotePath, size: uploadData.size ?? fileSize };
    } catch (err: any) {
      return { success: false, remotePath, size: 0, error: err.message ?? '上传异常' };
    }
  }

  // ─── download ────────────────────────────────────────────

  async download(
    remotePath: string,
    localPath: string,
    onProgress?: ProgressCallback,
  ): Promise<DownloadResult> {
    try {
      // 步骤 1：列出父目录找到目标文件，获取 fs_id
      const remoteParentDir = remotePath.substring(0, remotePath.lastIndexOf('/')) || '/';
      const fileName = this.getFileName(remotePath);
      const dirFiles = await this.listFiles(remoteParentDir);
      const targetFile = dirFiles.find((f) => f.name === fileName);

      if (!targetFile || targetFile.fsId === 0) {
        return { success: false, localPath, size: 0, error: '远程文件不存在' };
      }

      // 步骤 2：使用 fsids 获取下载链接
      const metaUrl = this.url('/rest/2.0/xpan/multimedia', {
        method: 'filemetas',
        fsids: JSON.stringify([targetFile.fsId]),
        dlink: '1',
      });

      const metaRes = await this.http(metaUrl);
      const metaData = await metaRes.json();

      if (!metaRes.ok || !metaData.list || metaData.list.length === 0) {
        return { success: false, localPath, size: 0, error: '远程文件不存在' };
      }

      const fileMeta = metaData.list[0];
      const downloadUrl = fileMeta.dlink;

      if (!downloadUrl) {
        return {
          success: false,
          localPath,
          size: 0,
          error: '无法获取下载链接',
        };
      }

      // 步骤 3：下载文件内容
      // 百度 dlink 有时缺少 token 或需要特定 header，补全 token 并设置 UA+Referer
      const dlUrl = new URL(downloadUrl);
      if (!dlUrl.searchParams.has('access_token')) {
        dlUrl.searchParams.set('access_token', this.accessToken);
      }
      console.log('[BaiduPan download] dlink:', dlUrl.toString().replace(/access_token=[^&]+/, 'access_token=***'));

      const dlRes = await this.http(dlUrl.toString(), {
        headers: {
          'User-Agent': 'pan.baidu.com',
        },
      });
      if (!dlRes.ok) {
        console.error('[BaiduPan download] failed HTTP', dlRes.status);
        return {
          success: false,
          localPath,
          size: 0,
          error: `下载失败 HTTP ${dlRes.status}`,
        };
      }

      const buffer = Buffer.from(await dlRes.arrayBuffer());

      // 确保目录存在
      const parentDir = path.dirname(localPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      fs.writeFileSync(localPath, buffer);

      if (onProgress) {
        onProgress(100, buffer.length, 0);
      }

      return {
        success: true,
        localPath,
        size: fileMeta.size,
      };
    } catch (err: any) {
      return {
        success: false,
        localPath,
        size: 0,
        error: err.message ?? '下载异常',
      };
    }
  }

  // ─── listFiles ───────────────────────────────────────────

  async listFiles(remoteDir: string): Promise<FileInfo[]> {
    try {
      const listUrl = this.url('/rest/2.0/xpan/file', {
        method: 'list',
        dir: remoteDir,
      });

      const res = await this.http(listUrl);
      const data = await res.json();

      if (!res.ok) {
        return [];
      }

      const list: any[] = data.list ?? [];

      return list.map((item: any) => ({
        name: item.server_filename ?? this.getFileName(item.path),
        path: item.path,
        size: Number(item.size ?? 0),
        mtime: Number(item.server_mtime ?? 0),
        isDir: item.isdir === 1,
        fsId: Number(item.fs_id ?? 0),
      }));
    } catch {
      return [];
    }
  }

  // ─── deleteFile ──────────────────────────────────────────

  async deleteFile(remotePath: string): Promise<DeleteResult> {
    try {
      const deleteUrl = this.url('/rest/2.0/xpan/file', {
        method: 'filemanager',
        opera: 'delete',
      });

      const body = new URLSearchParams({
        async: '0',
        filelist: JSON.stringify([remotePath]),
      });

      const res = await this.http(deleteUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      const data = await res.json();
      console.log('[BaiduPan delete] response:', JSON.stringify(data));

      const errno = data.errno ?? 0;
      if (!res.ok || errno !== 0) {
        const errMsg = data.error ?? data.errmsg ?? `errno=${errno}`;
        return { success: false, error: errMsg };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message ?? '删除异常' };
    }
  }

  // ─── getFileInfo ─────────────────────────────────────────

  async getFileInfo(remotePath: string): Promise<FileInfo> {
    // 先通过父目录列表获取 fs_id
    const parentDir = remotePath.substring(0, remotePath.lastIndexOf('/')) || '/';
    const fileName = this.getFileName(remotePath);
    const dirFiles = await this.listFiles(parentDir);
    const target = dirFiles.find((f) => f.name === fileName);
    const targetFsId = target?.fsId ?? 0;

    const metaUrl = this.url('/rest/2.0/xpan/multimedia', {
      method: 'filemetas',
      fsids: JSON.stringify(targetFsId > 0 ? [targetFsId] : []),
      dlink: '1',
    });

    const res = await this.http(metaUrl);
    const data = await res.json();

    if (!res.ok || !data.list || data.list.length === 0) {
      throw new Error(`文件不存在: ${remotePath}`);
    }

    const item = data.list[0];

    return {
      name: item.server_filename ?? this.getFileName(item.path),
      path: item.path,
      size: Number(item.size ?? 0),
      mtime: Number(item.server_mtime ?? 0),
      isDir: item.isdir === 1,
      fsId: Number(item.fs_id ?? 0),
    };
  }

  // ─── getUserInfo ─────────────────────────────────────────

  async getUserInfo(): Promise<{ name: string; avatar: string } | null> {
    try {
      const res = await this.http(this.url('/rest/2.0/xpan/nas', { method: 'uinfo' }));
      const data = await res.json();
      if (data.errno === 0) {
        return {
          name: data.baidu_name ?? data.netdisk_name ?? '未知用户',
          avatar: data.avatar_url ?? '',
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  // ─── getQuota ────────────────────────────────────────────

  async getQuota(): Promise<QuotaInfo> {
    const quotaUrl = this.url('/api/quota', { checkexpire: '1' });

    const res = await this.http(quotaUrl);
    const data = await res.json();

    if (!res.ok || data.errno !== 0) {
      throw new Error(data.errmsg || '配额查询失败');
    }

    return {
      total: Number(data.total ?? 0),
      used: Number(data.used ?? 0),
    };
  }
}
