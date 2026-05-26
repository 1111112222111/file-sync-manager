/**
 * src/main/notification/notification-manager.ts — 桌面通知
 *
 * 生产环境使用 Electron Notification API。
 */
import type { NotificationLevel } from '../../shared/types';

export class NotificationManager {
  private level: NotificationLevel = 'all';

  setLevel(level: NotificationLevel): void {
    this.level = level;
  }

  show(title: string, body: string): void {
    if (this.level === 'off') return;
    // 生产环境：new Notification({ title, body }).show()
    console.log(`[通知] ${title}: ${body}`);
  }

  showError(title: string, body: string): void {
    if (this.level === 'off') return;
    console.log(`[错误通知] ${title}: ${body}`);
  }
}
