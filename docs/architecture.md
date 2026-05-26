# 架构设计: 文件自动同步管理器

## 架构总览

```
┌──────────────────────────────────────────────────┐
│                  Electron Main Process           │
│  ┌─────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │AuthMgr  │ │SyncEngine│ │   TrayManager    │  │
│  └────┬────┘ └────┬─────┘ └────────┬─────────┘  │
│       │           │               │              │
│  ┌────┴───────────┴───────────────┴──────────┐  │
│  │           TransferQueue                   │  │
│  │  ┌──────┐ ┌──────┐ ┌──────────────────┐   │  │
│  │  │Queue │ │Retry │ │Progress Reporter │   │  │
│  │  └──────┘ └──────┘ └──────────────────┘   │  │
│  └───────────────────────────────────────────┘  │
│  ┌────────────┐ ┌──────────┐ ┌─────────────┐   │
│  │FileWatcher │ │  Config  │ │ConflictDet. │   │
│  │(chokidar)  │ │  Store   │ │             │   │
│  └─────┬──────┘ └──────────┘ └──────┬──────┘   │
│        │                            │           │
│  ┌─────┴────────────────────────────┴───────┐  │
│  │          ICloudAdapter                   │  │
│  │  ┌──────────────────────────────┐       │  │
│  │  │    BaiduPanAdapter           │       │  │
│  │  │  upload / download / list /  │       │  │
│  │  │  delete / info / quota       │       │  │
│  │  └──────────────────────────────┘       │  │
│  └─────────────────────────────────────────┘  │
│                    │ IPC (contextBridge)       │
├────────────────────┼──────────────────────────┤
│        Electron Renderer Process (React)      │
│  ┌──────────┬───────────┬──────────────────┐ │
│  │ DropZone │TransferPnl│  CloudBrowser    │ │
│  ├──────────┼───────────┼──────────────────┤ │
│  │WatchSrcP.│ Settings  │ ConflictDialog   │ │
│  ├──────────┴───────────┴──────────────────┤ │
│  │          AppShell + ThemeProvider        │ │
│  └─────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

## 进程模型

### 主进程 (Main Process)
负责：文件系统访问、网盘 API 调用、chokidar 监听、系统托盘、通知、开机自启。
不负责：任何 UI 渲染。

### 渲染进程 (Renderer Process)
负责：所有 UI 组件、拖拽检测、主题切换、用户交互。
不负责：直接访问文件系统或网络（通过 IPC 委托主进程）。

### IPC 通信契约

所有 IPC 通道采用 `namespace:action` 命名，通过 `contextBridge` 暴露类型化 API。

```
// ─── 同步引擎 ───
sync:upload(filePaths: string[])        → void          // 拖拽上传
sync:download(remotePath: string)       → void          // 下载请求
sync:getTasks()                         → TransferTask[] // 获取当前队列
sync:pauseTask(taskId: string)          → void
sync:cancelTask(taskId: string)        → void
sync:retryTask(taskId: string)          → void

// ─── 云端浏览 ───
cloud:listFiles(remoteDir: string)      → FileInfo[]     // 文件列表
cloud:getQuota()                        → QuotaInfo      // 空间配额
cloud:deleteFile(remotePath: string)    → void           // 删除云端文件

// ─── 文件监听 ───
watcher:getSources()                    → WatchSource[]  // 监听源列表
watcher:addSource(localPath: string)    → WatchSource    // 添加监听源
watcher:removeSource(id: string)        → void
watcher:getStatus(id: string)           → WatchStatus    // 源状态

// ─── 冲突处理 ───
conflict:resolve(taskId, choice)        → void           // choice: 'local'|'remote'|'both'

// ─── 授权 ───
auth:getStatus()                        → AuthStatus     // 授权状态
auth:startOAuth()                       → void           // 发起OAuth授权
auth:logout()                           → void

// ─── 配置 ───
config:getAll()                         → AppConfig
config:set(key: string, value: any)     → void
config:addFilterRule(rule)              → void
config:removeFilterRule(id: string)     → void

// ─── 历史记录 ───
history:getList(limit?, offset?)        → TransferRecord[]

// ─── 主进程 → 渲染进程事件推送 ───
→ transfer:progress(task: TransferTask)         // 进度更新 (100ms)
→ transfer:completed(task: TransferTask)        // 任务完成
→ transfer:failed(task: TransferTask)           // 任务失败
→ conflict:detected(conflict: ConflictInfo)     // 冲突触发
→ auth:statusChanged(status: AuthStatus)        // 授权状态变化
→ watcher:statusChanged(id, status)             // 监听源状态变化
→ notification:show(type, title, body)          // 触发桌面通知
```

## 模块接口契约

### ICloudAdapter

```typescript
interface ICloudAdapter {
  /** 上传文件。onProgress 返回 0-100 的进度百分比 */
  upload(
    localPath: string,
    remotePath: string,
    onProgress: (percent: number, speed: number, eta: number) => void
  ): Promise<UploadResult>;

  /** 下载文件 */
  download(
    remotePath: string,
    localPath: string,
    onProgress: (percent: number, speed: number, eta: number) => void
  ): Promise<DownloadResult>;

  /** 列出远程目录下的文件和文件夹 */
  listFiles(remoteDir: string): Promise<FileInfo[]>;

  /** 删除远程文件 */
  deleteFile(remotePath: string): Promise<DeleteResult>;

  /** 获取单个文件信息（大小、修改时间） */
  getFileInfo(remotePath: string): Promise<FileInfo>;

  /** 获取存储配额信息 */
  getQuota(): Promise<QuotaInfo>;
}

interface FileInfo {
  name: string;       // 文件名（含扩展名）
  path: string;       // 远程完整路径
  size: number;       // 字节
  mtime: number;      // 最后修改时间 Unix timestamp
  isDir: boolean;
}

interface UploadResult {
  success: boolean;
  remotePath: string;
  size: number;
  error?: string;     // 失败时的错误描述
}

interface DownloadResult {
  success: boolean;
  localPath: string;
  size: number;
  error?: string;
}

interface DeleteResult {
  success: boolean;
  error?: string;
}

interface QuotaInfo {
  total: number;      // 总空间 字节
  used: number;       // 已用空间 字节
}
```

### TransferQueue

```typescript
interface TransferTask {
  id: string;                              // UUID
  localPath: string;
  remotePath: string;
  direction: 'upload' | 'download';
  status: 'pending' | 'transferring' | 'paused' | 'completed' | 'failed';
  progress: number;                        // 0-100
  speed: number;                           // bytes/s
  eta: number;                             // 预估剩余秒数
  retryCount: number;
  error?: string;
  fileSize: number;
  transferredSize: number;
  createdAt: number;                       // Unix timestamp
}

interface TransferQueue {
  /** 添加任务（自动开始调度） */
  addTask(task: Omit<TransferTask, 'id' | 'status' | 'progress' | 'speed' | 'eta' | 'retryCount' | 'transferredSize' | 'createdAt'>): string;  // 返回 taskId

  /** 暂停任务 */
  pauseTask(taskId: string): void;

  /** 恢复任务 */
  resumeTask(taskId: string): void;

  /** 取消任务（移除出队列） */
  cancelTask(taskId: string): void;

  /** 重试失败任务 */
  retryTask(taskId: string): void;

  /** 获取当前所有任务列表 */
  getAllTasks(): TransferTask[];

  /** 获取队列统计 */
  getStats(): { pending: number; transferring: number; completed: number; failed: number; paused: number };

  /** 持久化当前未完成任务 */
  persistQueue(): void;

  /** 从持久化存储恢复队列 */
  restoreQueue(): Promise<void>;

  /** 设置并发上限 */
  setConcurrency(n: number): void;
}
```

### SyncEngine

```typescript
interface SyncEngine {
  /** 处理拖拽触发的上传（单个或多个文件） */
  handleDropUpload(filePaths: string[]): void;

  /** 处理文件变更触发的上传 */
  handleFileChange(localPath: string, watchSourceId: string): void;

  /** 处理下载请求 */
  handleDownload(remotePath: string, localPath: string): void;

  /** 获取同步状态摘要 */
  getSyncStatus(): SyncStatus;
}

interface SyncStatus {
  isSyncing: boolean;          // 是否有进行中的传输
  pendingCount: number;
  completedToday: number;
  lastSyncTime: number | null;
}
```

### FileWatcher

```typescript
interface WatchSource {
  id: string;                    // UUID
  localPath: string;             // 本地文件夹绝对路径
  remoteDir: string;             // 对应的云端目录
  status: 'active' | 'error' | 'paused';
  errorMessage?: string;         // 异常时的错误描述
  filterRules: FilterRule[];     // 此监听源独立的排除规则（未来扩展）
  createdAt: number;
}

interface FilterRule {
  id: string;                    // UUID
  pattern: string;               // 匹配模式（支持通配符 * 和 ?）
  enabled: boolean;
}

interface FileWatcher {
  /** 添加监听源 */
  addSource(localPath: string): Promise<WatchSource>;

  /** 移除监听源 */
  removeSource(sourceId: string): Promise<void>;

  /** 暂停监听某个源 */
  pauseSource(sourceId: string): void;

  /** 恢复监听某个源 */
  resumeSource(sourceId: string): void;

  /** 获取所有监听源 */
  getSources(): WatchSource[];

  /** 销毁所有监听器 */
  destroy(): Promise<void>;
}
```

### ConflictDetector

```typescript
interface ConflictInfo {
  taskId: string;
  localPath: string;
  remotePath: string;
  localFile: { size: number; mtime: number; };
  remoteFile: { size: number; mtime: number; };
}

type ConflictChoice = 'local' | 'remote' | 'both';

interface ConflictDetector {
  /** 检查是否存在冲突。无冲突返回 null */
  checkConflict(localPath: string, remotePath: string): Promise<ConflictInfo | null>;

  /** 执行用户选择的冲突处理 */
  resolveConflict(taskId: string, choice: ConflictChoice): Promise<void>;
}
```

## 数据流

### 上传链路

```
渲染进程                       主进程
────────                      ──────
DropZone.onDrop(files)
  → IPC: sync:upload(paths)
                               SyncEngine.handleDropUpload(paths)
                                 → for each file:
                                   ConflictDetector.checkConflict()
                                     → CloudAdapter.getFileInfo()
                                   if conflict → IPC: conflict:detected →
  ConflictDialog.show()
  用户选择 choice
  → IPC: conflict:resolve(id, choice)
                                   ConflictDetector.resolveConflict()
                                     (如果是 'remote': 跳过上传)
                                   TransferQueue.addTask(file)
                                     → 并发控制调度
                                     → CloudAdapter.upload(path, onProgress)
                                       → onProgress(100ms):
                                         IPC: transfer:progress →
  TransferPanel.updateProgress()
                                     → 完成:
                                       IPC: transfer:completed →
  TransferPanel.markCompleted()
  → IPC: notification:show()
                                     → 桌面通知
```

### 文件监听链路

```
主进程
──────
chokidar 检测文件变更 (add/change)
  → 防抖 300ms (同一文件去重)
  → FileWatcher.onChange(path, sourceId)
    → FilterManager.check(path)
      (如果被排除 → 跳过)
    → SyncEngine.handleFileChange(path, sourceId)
      → ConflictDetector.checkConflict()
      → TransferQueue.addTask()
      → CloudAdapter.upload()
```

## 目录结构

```
src/
├── main/                          # 主进程
│   ├── index.ts                   # 入口：窗口创建、应用生命周期
│   ├── ipc-registry.ts            # IPC 通道注册与 contextBridge 配置
│   ├── auth/
│   │   └── auth-manager.ts        # OAuth 流程、Token 管理
│   ├── sync/
│   │   ├── sync-engine.ts         # 同步协调中心
│   │   ├── transfer-queue.ts      # 传输队列管理
│   │   ├── conflict-detector.ts   # 冲突检测与处理
│   │   └── file-watcher.ts        # chokidar 封装
│   ├── cloud/
│   │   ├── adapter.interface.ts   # ICloudAdapter 接口定义
│   │   └── baidu-pan.adapter.ts   # 百度网盘适配器实现
│   ├── config/
│   │   ├── config-store.ts        # 配置读写 (electron-store)
│   │   └── filter-manager.ts      # 过滤规则管理
│   ├── tray/
│   │   └── tray-manager.ts        # 系统托盘、右键菜单
│   ├── notification/
│   │   └── notification-manager.ts # 桌面通知
│   └── db/
│       └── history-store.ts       # SQLite 传输记录
├── renderer/                      # 渲染进程
│   ├── index.html                 # HTML 入口
│   ├── main.tsx                   # React 入口
│   ├── App.tsx                    # AppShell：布局 + 导航 + 主题
│   ├── components/
│   │   ├── drop-zone/
│   │   │   └── DropZone.tsx       # 拖拽上传区域
│   │   ├── transfer-panel/
│   │   │   ├── TransferPanel.tsx  # 传输面板容器
│   │   │   └── TaskRow.tsx        # 单个任务行
│   │   ├── cloud-browser/
│   │   │   └── CloudBrowser.tsx   # 云端文件浏览器
│   │   ├── watch-sources/
│   │   │   └── WatchSourcePanel.tsx # 监听源管理
│   │   ├── settings/
│   │   │   └── SettingsPage.tsx   # 设置页
│   │   ├── conflict/
│   │   │   └── ConflictDialog.tsx # 冲突弹窗
│   │   └── common/
│   │       ├── Button.tsx
│   │       ├── ProgressBar.tsx
│   │       ├── Modal.tsx
│   │       └── Input.tsx
│   ├── hooks/
│   │   ├── useIpc.ts              # IPC 通信 hook
│   │   ├── useTransferTasks.ts    # 传输任务状态订阅
│   │   └── useTheme.ts            # 主题切换 hook
│   └── types/
│       └── ipc.ts                 # IPC 通道类型定义（与主进程共享）
├── shared/                        # 主进程和渲染进程共享
│   └── types.ts                   # FileInfo, TransferTask, WatchSource 等共享类型
└── styles/
    └── tokens.css                 # Design Tokens
```

## 架构决策记录 (ADR)

### ADR-001: 单向备份模式
- **决策**: 同步方向为本地 → 云端单向备份，下载为手动触发
- **理由**: 用户场景是备份而非协作，双向同步会引入复杂的冲突和删除传播问题
- **后果**: 简化 SyncEngine 逻辑，不需要处理远程变更监听

### ADR-002: 适配器模式隔离云盘
- **决策**: 定义 ICloudAdapter 接口，百度网盘作为首个实现
- **理由**: 用户明确希望后续接入其他云盘，适配器模式是最小化核心改动的方案
- **后果**: 适配器只负责 CRUD 操作，不包含业务逻辑（冲突检测、队列管理等由上层处理）

### ADR-003: 主进程集中所有 I/O
- **决策**: 文件系统访问、网络请求、chokidar 监听全部在主进程执行，渲染进程仅做 UI
- **理由**: Electron 安全最佳实践，避免渲染进程直接访问 Node.js API
- **后果**: IPC 通道数量较多，但通过 contextBridge 类型化可以保证类型安全；渲染进程不可直接 require('fs')

### ADR-004: 传输队列持久化
- **决策**: 未完成的传输任务在应用退出时写入 SQLite，启动时恢复
- **理由**: 防止应用崩溃或意外退出导致传输任务丢失
- **后果**: 需要维护 SQLite schema 的向后兼容；大文件传输中断不可恢复（需重新开始），但任务记录不会丢失

### ADR-005: 前端使用纯 React 无框架
- **决策**: 使用 React + TypeScript，不引入 Next.js / Remix 等全栈框架
- **理由**: Electron 渲染进程是纯客户端环境，不需要 SSR、路由等能力
- **后果**: 路由使用简单状态切换（无 react-router），构建使用 Vite

## 数据存储 Schema

### ConfigStore (electron-store JSON)

```json
{
  "baiduToken": {
    "accessToken": "encrypted...",
    "refreshToken": "encrypted...",
    "expiresAt": 1716912000
  },
  "remoteRootPath": "/我的同步文件",
  "notificationLevel": "all",
  "theme": "dark",
  "autoLaunch": false,
  "filterRules": [
    { "id": "uuid-1", "pattern": "*.tmp", "enabled": true },
    { "id": "uuid-2", "pattern": "node_modules", "enabled": true }
  ],
  "watchSources": [
    {
      "id": "uuid-3",
      "localPath": "C:\\Users\\xxx\\Documents\\Projects",
      "remoteDir": "/我的同步文件/Projects",
      "status": "active"
    }
  ]
}
```

### HistoryStore (SQLite)

```sql
CREATE TABLE transfer_history (
  id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('upload', 'download')),
  status TEXT NOT NULL CHECK(status IN ('completed', 'failed')),
  remote_path TEXT,
  local_path TEXT NOT NULL,
  error_message TEXT,
  started_at INTEGER NOT NULL,
  completed_at INTEGER NOT NULL
);

CREATE INDEX idx_history_date ON transfer_history(completed_at DESC);
```
