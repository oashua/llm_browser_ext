/// <reference types="vitest" />
import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.config'

export default defineConfig({
  plugins: [preact(), crx({ manifest })],
  test: {
    // 显式排除 worktree 目录，避免测试重复收集
    exclude: ['**/node_modules/**', '**/dist/**', '**/.worktrees/**'],
  },
})
