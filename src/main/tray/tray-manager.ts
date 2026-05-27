/**
 * src/main/tray/tray-manager.ts — 系统托盘管理
 */
import { Tray, Menu, nativeImage, BrowserWindow } from 'electron';
import * as path from 'path';

const TRAY_ICON = path.join(__dirname, '../../assets/tray/tray-default.png');

export class TrayManager {
  private tray: Tray | null = null;

  init(mainWindow: BrowserWindow): void {
    const icon = nativeImage.createFromPath(TRAY_ICON);
    const sizedIcon = icon.resize({ width: 16, height: 16 });

    this.tray = new Tray(sizedIcon);
    this.tray.setToolTip('文件自动同步管理器');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: '显示主窗口',
        click: () => {
          mainWindow.show();
          mainWindow.focus();
        },
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          mainWindow.destroy();
        },
      },
    ]);

    this.tray.setContextMenu(contextMenu);
    this.tray.on('double-click', () => {
      mainWindow.show();
      mainWindow.focus();
    });
  }

  destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}
