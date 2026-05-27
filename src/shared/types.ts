// ============================================================
// src/shared/types.ts — 主进程和渲染进程共享的类型定义
// ============================================================

// ─── 云端适配器相关 ───

/** 文件基本信息 */
export interface FileInfo {
  name: string;       // 文件名（含扩展名）
  path: string;       // 远程完整路径
  size: number;       // 字节
  mtime: number;      // 最后修改时间 Unix timestamp
  isDir: boolean;
}

/** 上传结果 */
export interface UploadResult {
  success: boolean;
  remotePath: string;
  size: number;
  error?: string;     // 失败时的错误描述
}

/** 下载结果 */
export interface DownloadResult {
  success: boolean;
  localPath: string;
  size: number;
  error?: string;
}

/** 删除结果 */
export interface DeleteResult {
  success: boolean;
  error?: string;
}

/** 存储配额信息 */
export interface QuotaInfo {
  total: number;      // 总空间（字节）
  used: number;       // 已用空间（字节）
}

// ─── 传输队列 ───

/** 传输方向 */
export type TransferDirection = 'upload' | 'download';

/** 传输状态 */
export type TransferStatus = 'pending' | 'transferring' | 'paused' | 'completed' | 'failed';

/** 传输任务 */
export interface TransferTask {
  id: string;                     // UUID
  localPath: string;
  remotePath: string;
  direction: TransferDirection;
  status: TransferStatus;
  progress: number;               // 0-100
  speed: number;                  // bytes/s
  eta: number;                    // 预估剩余秒数
  retryCount: number;
  error?: string;
  fileSize: number;
  transferredSize: number;
  createdAt: number;              // Unix timestamp
}

/** 创建任务所需的字段（不含自动生成的字段） */
export interface CreateTaskInput {
  localPath: string;
  remotePath: string;
  direction: TransferDirection;
  fileSize: number;
}

/** 队列统计 */
export interface QueueStats {
  pending: number;
  transferring: number;
  completed: number;
  failed: number;
  paused: number;
}

// ─── 文件监听 ───

/** 过滤规则 */
export interface FilterRule {
  id: string;        // UUID
  pattern: string;   // 匹配模式（支持通配符 * 和 ?）
  enabled: boolean;
}

/** 监听源 */
export interface WatchSource {
  id: string;              // UUID
  localPath: string;       // 本地文件夹绝对路径
  remoteDir: string;       // 对应的云端目录
  status: WatchStatus;
  errorMessage?: string;
  filterRules: FilterRule[];
  createdAt: number;
}

/** 监听源状态 */
export type WatchStatus = 'active' | 'error' | 'paused';

// ─── 冲突检测 ───

/** 冲突信息 */
export interface ConflictInfo {
  taskId: string;
  localPath: string;
  remotePath: string;
  localFile: { size: number; mtime: number };
  remoteFile: { size: number; mtime: number };
}

/** 冲突解决选择 */
export type ConflictChoice = 'local' | 'remote' | 'both';

// ─── 同步引擎 ───

/** 同步状态摘要 */
export interface SyncStatus {
  isSyncing: boolean;
  pendingCount: number;
  completedToday: number;
  lastSyncTime: number | null;
}

// ─── 授权 ───

/** OAuth Token */
export interface BaiduToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;     // Unix timestamp
}

/** 授权状态 */
export interface AuthStatus {
  isAuthorized: boolean;
  expiresAt: number | null;
  userName?: string;
}

// ─── 配置 ───

/** 通知级别 */
export type NotificationLevel = 'all' | 'error_only' | 'off';

/** 主题 */
export type ThemeMode = 'light' | 'dark' | 'system';

/** 百度网盘 API 凭证（从开发者控制台获取） */
export interface BaiduApiCredentials {
  appId: string;
  apiKey: string;
  secretKey: string;
}

/** 应用配置 */
export interface AppConfig {
  baiduToken: BaiduToken | null;
  baiduCredentials: BaiduApiCredentials | null;
  remoteRootPath: string;
  notificationLevel: NotificationLevel;
  theme: ThemeMode;
  autoLaunch: boolean;
  filterRules: FilterRule[];
}

// ─── 传输历史 ───

/** 传输记录 */
export interface TransferRecord {
  id: string;
  fileName: string;
  fileSize: number;
  direction: TransferDirection;
  status: 'completed' | 'failed';
  remotePath: string | null;
  localPath: string;
  errorMessage: string | null;
  startedAt: number;
  completedAt: number;
}

/** 历史查询参数 */
export interface HistoryQuery {
  limit?: number;
  offset?: number;
}

// ─── 工具类型 ───

/** 绝对值返回的正数结果 */
export type PositiveResult<T> =
  T extends { success: true } ? T & { error: undefined } : T;

/** 进度回调 */
export type ProgressCallback = (percent: number, speed: number, eta: number) => void;
