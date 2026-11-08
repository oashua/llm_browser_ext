# LLM Sidebar（浏览器 LLM 侧边栏助手）

Chrome MV3 扩展：在侧边栏与 LLM 对话，基于当前/选定标签页内容回答。支持 Anthropic 兼容端点、远程 MCP（streamable HTTP）、页面文本/截图/图片读取。

## 开发

```bash
npm install
npm test          # Vitest 单测
npm run check     # tsc 类型检查
npm run build     # 产出 dist/
```

`chrome://extensions` → 开发者模式 → 加载已解压 → 选择 `dist/`。

## 使用

1. 点击扩展图标打开侧边栏，⚙ 设置 API Base URL / Key / 模型名（任意 Anthropic 兼容端点，如 GLM 的 Anthropic 兼容端点、OpenRouter）
2. 顶部 📑 勾选作为上下文的标签页（默认当前活动页）
3. 直接提问；agent 可调用内置工具（读页面/截图/取图/列标签页/读其他标签页）与已配置的 MCP 工具

## 内置工具

| 工具 | 作用 |
|---|---|
| `get_page_content` | 提取指定标签页结构化正文（刷新上下文页用） |
| `get_screenshot` | 截取当前可视区域（vision 输入） |
| `get_page_images` | 抓取页面图片（默认面积最大 3 张） |
| `get_settings` / `update_settings` | 查看/修改自身配置（模型、提示词、截断长度、MCP） |

隐私边界：agent **不能**枚举或读取用户未勾选的标签页（无 `list_tabs`/`read_tab` 工具）；跨页上下文一律通过侧边栏顶部的 📑 勾选器添加。

## 架构

agent 循环（Anthropic SSE 流式 + 工具分发 + MCP client）运行在 side panel 页面内，直接调用 `chrome.scripting`/`chrome.tabs`；页面提取按需注入 content script；Service Worker 仅注册面板。设计文档：`docs/superpowers/specs/2026-11-03-browser-llm-sidebar-design.md`，实现计划：`docs/superpowers/plans/2026-11-03-browser-llm-sidebar.md`。

## 验收清单（手动 E2E）

1. 加载 `dist/` → 侧边栏打开 → 配置 baseUrl/apiKey/model → 保存无报错
2. 打开普通网页提问「这个页面讲了什么」→ 回答引用页面实际内容
3. 要求看图表/图片 → 触发 `get_screenshot` / `get_page_images`，vision 模型能描述
4. TabPicker 勾选多标签页对比提问；让 agent `list_tabs` + `read_tab`
5. 添加远程 MCP server → 显示已连接与工具数 → 对话中调用 MCP 工具
6. 填错 key → 错误卡片 → 修复后重试恢复
7. `chrome://settings` 提问 → 明确提示内部页面不可提取
8. 重启浏览器 → 历史恢复；清空会话按钮有效
