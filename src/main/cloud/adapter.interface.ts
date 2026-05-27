/**
 * src/main/cloud/adapter.interface.ts — ICloudAdapter 接口定义
 *
 * 云端存储适配器接口。所有网盘实现（百度、阿里等）均需实现此接口。
 * 适配器只负责 CRUD 操作，不包含业务逻辑（冲突检测、队列管理由上层处理）。
 */

import type { FileInfo, UploadResult, DownloadResult, DeleteResult, QuotaInfo, ProgressCallback } from '../../shared/types';

export interface ICloudAdapter {
  /** 上传文件。onProgress 返回 0-100 的进度百分比、当前速度(bytes/s)、预估剩余秒数 */
  upload(
    localPath: string,
    remotePath: string,
    onProgress?: ProgressCallback,
  ): Promise<UploadResult>;

  /** 下载文件 */
  download(
    remotePath: string,
    localPath: string,
    onProgress?: ProgressCallback,
  ): Promise<DownloadResult>;

  /** 列出远程目录下的文件和文件夹 */
  listFiles(remoteDir: string): Promise<FileInfo[]>;

  /** 删除远程文件 */
  deleteFile(remotePath: string): Promise<DeleteResult>;

  /** 获取单个文件信息 */
  getFileInfo(remotePath: string): Promise<FileInfo>;

  /** 获取存储配额信息 */
  getQuota(): Promise<QuotaInfo>;

  /** 更新访问令牌（OAuth 授权后调用） */
  setAccessToken(token: string): void;
}
