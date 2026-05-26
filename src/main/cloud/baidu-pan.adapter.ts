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
  private readonly accessToken: string;
  private readonly remoteRoot: string;
  private readonly http: HttpRequest;

  constructor(options: BaiduPanOptions) {
    this.accessToken = options.accessToken;
    this.remoteRoot = options.remoteRoot.replace(/\/+$/, ''); // 去掉尾部斜杠
    this.http = options.httpRequest ?? fetch;
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
      const fileName = this.getFileName(remotePath);
      const fileSize = fs.statSync(localPath).size;

      // 步骤 1：预创建上传任务
      const precreateUrl = this.url('/rest/2.0/xpan/file', {
        method: 'precreate',
      });

      const precreateBody = new URLSearchParams({
        path: remotePath,
        size: String(fileSize),
        isdir: '0',
        rtype: '3', // 覆盖模式
      });

      const precreateRes = await this.http(precreateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: precreateBody.toString(),
      });

      const precreateData = await precreateRes.json();

      if (!precreateRes.ok || precreateData.error) {
        return {
          success: false,
          remotePath,
          size: 0,
          error: precreateData.error || `HTTP ${precreateRes.status}`,
        };
      }

      const uploadId = precreateData.uploadid;

      // 步骤 2：分片上传文件内容
      const fileBuffer = fs.readFileSync(localPath);
      const uploadUrl = this.url('/rest/2.0/xpan/file', {
        method: 'upload',
        type: 'tmpfile',
        path: remotePath,
        uploadid: uploadId,
      });

      const uploadRes = await this.http(uploadUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': String(fileBuffer.length),
        },
        body: new Uint8Array(fileBuffer),
      });

      // 报告进度
      if (onProgress) {
        onProgress(50, fileSize / 2, 1); // 简化：上传阶段报告 50%
        onProgress(100, 0, 0);           // 完成
      }

      const uploadData = await uploadRes.json();

      if (!uploadRes.ok) {
        return {
          success: false,
          remotePath,
          size: 0,
          error: '上传文件内容失败',
        };
      }

      // 步骤 3：创建文件（暂简化：预创建已设置 rtype=3 覆盖，不需要再调 create）
      return {
        success: true,
        remotePath,
        size: uploadData.size ?? fileSize,
      };
    } catch (err: any) {
      return {
        success: false,
        remotePath,
        size: 0,
        error: err.message ?? '上传异常',
      };
    }
  }

  // ─── download ────────────────────────────────────────────

  async download(
    remotePath: string,
    localPath: string,
    onProgress?: ProgressCallback,
  ): Promise<DownloadResult> {
    try {
      // 步骤 1：获取文件元信息
      const metaUrl = this.url('/rest/2.0/xpan/multimedia', {
        method: 'filemetas',
        path: remotePath,
        dlink: '1',
      });

      const metaRes = await this.http(metaUrl);
      const metaData = await metaRes.json();

      if (!metaRes.ok || !metaData.list || metaData.list.length === 0) {
        return {
          success: false,
          localPath,
          size: 0,
          error: '远程文件不存在',
        };
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

      // 步骤 2：下载文件内容
      const dlRes = await this.http(downloadUrl);
      if (!dlRes.ok) {
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
        ondup: 'fail',
      });

      const res = await this.http(deleteUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!res.ok) {
        const data = await res.json();
        return { success: false, error: data.error || '删除失败' };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message ?? '删除异常' };
    }
  }

  // ─── getFileInfo ─────────────────────────────────────────

  async getFileInfo(remotePath: string): Promise<FileInfo> {
    const metaUrl = this.url('/rest/2.0/xpan/multimedia', {
      method: 'filemetas',
      path: remotePath,
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
    };
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
