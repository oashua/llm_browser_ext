# Landing Page 设计（GitHub Pages 产品展示页）

日期：2026-11-09
状态：已确认（用户选方案 A，浅色主题）

## 目标

为 LLM Sidebar 扩展制作一个发布到 GitHub Pages 的产品展示页，展示扩展特色与功能，引导用户安装。发布初期无真实截图，所有功能演示图用 CSS 还原的模拟界面；后续按截图指南逐张替换为真实截图。

## 方案

- **单文件自包含**：根目录 `index.html`，CSS/JS 全内联，零依赖、零构建。
  GitHub Pages 配置为「从 main 分支根目录发布」即可，最终地址
  `https://oashua.github.io/llm_browser_ext/`。
- **浅色主题**（用户指定）。设计 token 直接取自扩展 `src/sidepanel/sidepanel.css`
  的亮色变量：`--bg:#f7f7f8`、`--surface:#fff`、`--surface-2:#f0f0f2`、
  `--border:#e4e4e7`、`--text:#18181b`、`--text-dim:#71717a`，主按钮为黑底白字
  （扩展自身的单色 accent）。字体同扩展：`system-ui, 'Segoe UI', 'Microsoft YaHei'`。
- **模拟界面还原**：模拟图里浏览器窗口含 Chrome 风格标签条+地址栏，右侧为
  1:1 风格还原的扩展侧边栏（顶栏 `[📋 上下文 (n)] [chips] … [模型名] [⚙]`、
  消息气泡、`▸ 工具名 完成` 折叠 trace、输入框、设置表单），对话内容演示各功能，
  工具名用真实注册名（`get_page_content` / `read_tab` / `get_screenshot` /
  `get_page_html` / `update_settings` / `list_tabs`）。

## 页面结构（单页 7 区）

1. **顶栏**（sticky）：项目名 + GitHub 链接 + 「安装」锚点按钮
2. **Hero**：主标语「打开任意网页，和 AI 聊你正在看的页面」+ 副文案 +
   CTA（Releases / 快速开始）+ 大模拟图（新闻页 + 侧边栏问答，trace 折叠态）
3. **功能特色**（6 小节，图文左右交替）：
   - 网页问答：trace 展开态，正文提取结果 + 要点总结
   - 多标签对比：上下文下拉勾选两个标签 + 价格对比表格回答
   - 看得见图片：`get_screenshot` trace 内嵌缩略图 + 图表分析
   - 完整 HTML 模式：`get_page_html` 代码 trace + class 结构回答
   - 接任意模型 + MCP：设置面板模拟（端点、密钥、模型 chips、MCP 已连接状态）
   - 对话改配置：「换到 glm-4v」→ `update_settings` → 确认回复
4. **隐私**：3 张卡片（本机存储 / 默认只读勾选页 / 不外发数据）
5. **快速开始**：3 步（安装 → 配置 → 开问）
6. **Footer**：仓库链接与技术栈说明

## 截图替换机制

每个模拟图外包 `<figure class="shot" data-shot="<id>">`，内附 HTML 注释说明
替换方法（放 `assets/shot-<id>.png` 后将 `.mock` div 换成 `<img>`）。
截图清单与操作指南单独放 `docs/screenshot-guide.md`。

## 响应式与动效

- ≥900px 双栏交替；<900px 单列，模拟图等比缩放。
- 动效仅 IntersectionObserver 滚动淡入；`prefers-reduced-motion` 时禁用。
- JS 约 20 行，页面在无 JS 时内容完整可读。

## 交付物

1. `index.html`（根目录）
2. `docs/screenshot-guide.md`（每张图：目标网站、测试问题、期望回复、
   窗口尺寸、注意事项、替换方法；附 GitHub Pages 发布步骤）

## 不做

- 不做亮暗双主题、不做多语言、不引入任何外部依赖/CDN 资源、不做构建步骤。
