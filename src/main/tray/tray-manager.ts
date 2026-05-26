/**
 * src/main/tray/tray-manager.ts — 系统托盘管理
 *
 * 生产环境使用 Electron Tray API。
 */
export class TrayManager {
  private isSyncing = false;
  private hasError = false;

  setSyncing(syncing: boolean): void {
    this.isSyncing = syncing;
    this.updateIcon();
  }

  setError(error: boolean): void {
    this.hasError = error;
    this.updateIcon();
  }

  private updateIcon(): void {
    // 生产环境：根据 isSyncing / hasError 切换托盘图标
  }

  destroy(): void {
    // 生产环境：移除托盘图标
  }
}
