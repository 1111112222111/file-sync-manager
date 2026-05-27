import { defineConfig } from 'vite';
import { resolve } from 'path';

const external = [
  'electron',
  'chokidar',
  'electron-store',
  'electron-auto-launch',
  'better-sqlite3',
  'dotenv',
  'path',
  'fs',
  'http',
  'https',
  'crypto',
  'url',
  'child_process',
  'os',
  'stream',
  'util',
  'assert',
  'events',
  'buffer',
  'tty',
];

export default defineConfig({
  define: {
    'process.env': 'process.env',
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
  build: {
    outDir: 'dist/main',
    // 多入口：主进程 + preload
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'src/main/index.ts'),
        preload: resolve(__dirname, 'src/main/preload.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        format: 'cjs',
      },
      external,
    },
    minify: false,
    sourcemap: true,
  },
});
