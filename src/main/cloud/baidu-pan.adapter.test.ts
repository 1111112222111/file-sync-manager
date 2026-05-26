/**
 * src/main/cloud/baidu-pan.adapter.test.ts
 *
 * BaiduPanAdapter 行为测试。
 * Mock 外部依赖（fs、HTTP 请求），验证接口契约和错误处理。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FileInfo, UploadResult, DownloadResult, DeleteResult, QuotaInfo } from '../../shared/types';

// ─── Mock fs ───
vi.mock('fs', () => ({
  default: {
    statSync: vi.fn().mockReturnValue({ size: 2048 }),
    readFileSync: vi.fn().mockReturnValue(Buffer.from('mock-file-content')),
    writeFileSync: vi.fn(),
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
  },
  statSync: vi.fn().mockReturnValue({ size: 2048 }),
  readFileSync: vi.fn().mockReturnValue(Buffer.from('mock-file-content')),
  writeFileSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
}));

import { BaiduPanAdapter } from './baidu-pan.adapter';

// ─── Mock Response 辅助 ───

function mockResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: async () => body,
    text: async () => JSON.stringify(body),
    arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer, // 模拟文件内容
    headers: new Headers(),
  } as Response;
}

describe('BaiduPanAdapter', () => {
  const testToken = 'test-access-token-12345';
  const remoteRoot = '/apps/我的同步文件';
  let adapter: BaiduPanAdapter;
  let mockHttp: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockHttp = vi.fn();
    adapter = new BaiduPanAdapter({
      accessToken: testToken,
      remoteRoot,
      httpRequest: mockHttp,
    });
  });

  // ─── upload ───
  describe('upload', () => {
    it('应该向正确端点发送 upload 预创建请求', async () => {
      mockHttp
        .mockResolvedValueOnce(mockResponse({ path: '/apps/同步/test.txt', uploadid: 'abc-upload' }))
        .mockResolvedValueOnce(mockResponse({ size: 1024 }));

      await adapter.upload('/local/test.txt', '/apps/同步/test.txt');

      const [precreateUrl] = mockHttp.mock.calls[0];
      expect(precreateUrl).toContain('precreate');
    });

    it('应该返回成功结果包含 remotePath 和 size', async () => {
      mockHttp
        .mockResolvedValueOnce(mockResponse({ path: '/apps/同步/test.txt', uploadid: 'abc-upload' }))
        .mockResolvedValueOnce(mockResponse({ size: 1024 }));

      const result: UploadResult = await adapter.upload('/local/test.txt', '/apps/同步/test.txt');

      expect(result.success).toBe(true);
      expect(result.remotePath).toBe('/apps/同步/test.txt');
      expect(result.size).toBe(1024);
    });

    it('预创建失败时应返回 success=false 和错误信息', async () => {
      mockHttp.mockResolvedValueOnce(mockResponse({ error: '权限不足' }, 403));

      const result: UploadResult = await adapter.upload('/local/test.txt', '/apps/同步/test.txt');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('上传过程中应调用 onProgress 回调报告进度', async () => {
      mockHttp
        .mockResolvedValueOnce(mockResponse({ path: '/apps/同步/test.txt', uploadid: 'abc-upload' }))
        .mockResolvedValueOnce(mockResponse({ size: 1024 }));

      const onProgress = vi.fn();

      await adapter.upload('/local/test.txt', '/apps/同步/test.txt', onProgress);

      expect(onProgress).toHaveBeenCalled();
      const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1];
      expect(lastCall[0]).toBeGreaterThanOrEqual(0);
      expect(lastCall[0]).toBeLessThanOrEqual(100);
    });
  });

  // ─── download ───
  describe('download', () => {
    it('应该调用正确的下载端点', async () => {
      mockHttp.mockResolvedValueOnce(mockResponse({
        list: [{ fs_id: 1, path: '/apps/同步/test.txt', size: 512, dlink: 'http://dl.example.com/test.txt' }],
      }));

      await adapter.download('/apps/同步/test.txt', '/local/downloads/test.txt');

      const [url] = mockHttp.mock.calls[0];
      expect(url).toContain('filemetas');
    });

    it('下载成功时应返回 success=true', async () => {
      mockHttp
        .mockResolvedValueOnce(mockResponse({
          list: [{ fs_id: 1, path: '/apps/同步/test.txt', size: 2048, dlink: 'http://dl.example.com/test.txt' }],
        }))
        .mockResolvedValueOnce(mockResponse({}));

      const result: DownloadResult = await adapter.download(
        '/apps/同步/test.txt',
        '/local/downloads/test.txt',
      );

      expect(result.success).toBe(true);
      expect(result.size).toBe(2048);
    });

    it('文件不存在时应返回 success=false', async () => {
      mockHttp.mockResolvedValueOnce(mockResponse({ list: [] }));

      const result: DownloadResult = await adapter.download(
        '/apps/同步/nonexistent.txt',
        '/local/downloads/nonexistent.txt',
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('不存在');
    });
  });

  // ─── listFiles ───
  describe('listFiles', () => {
    it('应该返回远程目录下的文件列表', async () => {
      const mockList = [
        { fs_id: 1, path: '/apps/同步/file1.txt', size: 100, server_mtime: 1716912000, isdir: 0 },
        { fs_id: 2, path: '/apps/同步/subdir', size: 0, server_mtime: 1716912000, isdir: 1 },
      ];
      mockHttp.mockResolvedValueOnce(mockResponse({ list: mockList }));

      const files: FileInfo[] = await adapter.listFiles('/apps/同步');

      expect(files).toHaveLength(2);
      expect(files[0]).toMatchObject({
        name: 'file1.txt',
        path: '/apps/同步/file1.txt',
        size: 100,
        isDir: false,
      });
      expect(files[1]).toMatchObject({
        name: 'subdir',
        isDir: true,
      });
    });

    it('空目录应返回空数组', async () => {
      mockHttp.mockResolvedValueOnce(mockResponse({ list: [] }));

      const files: FileInfo[] = await adapter.listFiles('/apps/同步/空目录');

      expect(files).toHaveLength(0);
    });

    it('API 报错时应返回空数组', async () => {
      mockHttp.mockResolvedValueOnce(mockResponse({ error_msg: '目录不存在' }, 404));

      const files: FileInfo[] = await adapter.listFiles('/apps/同步/不存在');

      expect(files).toHaveLength(0);
    });
  });

  // ─── deleteFile ───
  describe('deleteFile', () => {
    it('应调用文件删除端点并返回成功', async () => {
      mockHttp.mockResolvedValueOnce(mockResponse({}));

      const result: DeleteResult = await adapter.deleteFile('/apps/同步/to-delete.txt');

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('删除失败时应返回错误信息', async () => {
      mockHttp.mockResolvedValueOnce(mockResponse({ error: '文件不存在' }, 404));

      const result: DeleteResult = await adapter.deleteFile('/apps/同步/nonexistent.txt');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // ─── getFileInfo ───
  describe('getFileInfo', () => {
    it('应返回文件的名称、大小和修改时间', async () => {
      mockHttp.mockResolvedValueOnce(mockResponse({
        list: [{
          fs_id: 1,
          path: '/apps/同步/readme.md',
          size: 512,
          server_mtime: 1716912000,
          isdir: 0,
        }],
      }));

      const info: FileInfo = await adapter.getFileInfo('/apps/同步/readme.md');

      expect(info.name).toBe('readme.md');
      expect(info.size).toBe(512);
      expect(info.mtime).toBe(1716912000);
      expect(info.isDir).toBe(false);
    });

    it('文件不存在时应抛出异常', async () => {
      mockHttp.mockResolvedValueOnce(mockResponse({ list: [] }));

      await expect(
        adapter.getFileInfo('/apps/同步/nonexistent.txt'),
      ).rejects.toThrow();
    });
  });

  // ─── getQuota ───
  describe('getQuota', () => {
    it('应返回总空间和已用空间', async () => {
      mockHttp.mockResolvedValueOnce(mockResponse({
        errno: 0,
        total: 2 * 1024 * 1024 * 1024 * 1024, // 2TB
        used: 500 * 1024 * 1024 * 1024,       // 500GB
      }));

      const quota: QuotaInfo = await adapter.getQuota();

      expect(quota).toMatchObject({
        total: 2 * 1024 * 1024 * 1024 * 1024,
        used: 500 * 1024 * 1024 * 1024,
      });
    });

    it('API 失败时应抛出异常', async () => {
      mockHttp.mockResolvedValueOnce(mockResponse({ errno: -1, errmsg: '配额查询失败' }, 500));

      await expect(adapter.getQuota()).rejects.toThrow();
    });
  });

  // ─── access_token 验证 ───
  describe('access_token 处理', () => {
    it('所有 API 请求应携带 access_token 参数', async () => {
      mockHttp.mockResolvedValueOnce(mockResponse({ list: [] }));

      await adapter.listFiles('/apps/test');

      const [url] = mockHttp.mock.calls[0];
      expect(url).toContain(`access_token=${testToken}`);
    });
  });
});
