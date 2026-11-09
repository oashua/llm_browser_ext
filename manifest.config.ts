import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'LLM Sidebar',
  version: '0.1.2',
  description: '在侧边栏与 LLM 对话，基于当前网页内容回答',
  action: {},
  side_panel: { default_path: 'src/sidepanel/index.html' },
  background: { service_worker: 'src/background/index.ts', type: 'module' },
  permissions: ['sidePanel', 'storage', 'scripting', 'tabs'],
  host_permissions: ['<all_urls>'],
})
