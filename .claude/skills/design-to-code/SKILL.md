---
name: design-to-code
description: 串联 ui-ux-pro-max（设计系统生成）和 frontend-design（代码实现），从需求到可运行 UI 代码的完整流程。当用户要求构建页面、组件、应用界面并希望有系统化的设计依据时使用。先搜索设计数据库生成设计规范，再将规范传递给 frontend-design 产出代码。
---

# Design to Code

串联流水线：**ui-ux-pro-max（设计系统）→ frontend-design（代码实现）**。

ui-ux-pro-max 提供"做什么"（设计规范和约束），frontend-design 提供"怎么做"（创意代码实现）。只用 ui-ux-pro-max 不出代码，只用 frontend-design 缺少产品类型的系统化考量——两者串联才能既全局一致又视觉出色。

## 适用场景

- 用户要求构建新页面 / 组件 / 完整应用界面
- 用户说"做一个 XX 产品的 landing page / dashboard / 设置页"
- 用户需要差异化设计，但又希望有行业依据支撑
- 需要设计系统保持多页面一致性

## 流程

### 阶段 1：需求分析

从用户请求中提取关键信息，如不明确则向用户确认：

- **产品类型**：SaaS / 电商 / 金融 / 医疗 / 作品集 / 服务 / 游戏 等
- **风格关键词**：极简 / 优雅 / 科技感 / 暗色 / 活力 / 专业 等
- **行业**：fintech / healthcare / beauty / education / gaming 等
- **技术栈**：React / Next.js / Vue / Svelte / HTML+Tailwind（默认）等
- **页面范围**：单页面还是多页面系统？有哪些具体页面？

将分析结果以一句话总结给用户确认。

### 阶段 2：生成设计系统（ui-ux-pro-max）

先探测 Python 命令（Windows 用 `python`，macOS/Linux 用 `python3`）：
```bash
python --version 2>&1 || python3 --version
```

运行设计系统生成命令。**多页面项目必须用 `--persist`**，单页面可省略。

```bash
python .claude/skills/ui-ux-pro-max/scripts/search.py "<产品类型> <行业> <风格关键词>" --design-system -p "<项目名称>"
```

多页面项目：
```bash
python .claude/skills/ui-ux-pro-max/scripts/search.py "<产品类型> <行业> <风格关键词>" --design-system --persist -p "<项目名称>"
```

这会输出：
- 推荐风格 + 理由
- 色彩方案（主色、辅色、强调色、背景色）
- 字体搭配（标题 + 正文字体，含 Google Fonts 引用）
- 布局模式
- 效果指导（阴影、圆角、透明度）
- 应避免的反模式
- 交付前检查清单

**如果设计系统对某项（字体/色彩/UX 细节）覆盖不够**，补充细化搜索：
```bash
python .claude/skills/ui-ux-pro-max/scripts/search.py "<关键词>" --domain typography   # 字体
python .claude/skills/ui-ux-pro-max/scripts/search.py "<关键词>" --domain color        # 色彩
python .claude/skills/ui-ux-pro-max/scripts/search.py "<关键词>" --domain ux           # UX 准则
python .claude/skills/ui-ux-pro-max/scripts/search.py "<关键词>" --stack <技术栈>      # 技术栈指南
```

### 阶段 3：多页面设计系统持久化（如有多个页面）

对每个独立页面，生成页面级设计覆盖：
```bash
python .claude/skills/ui-ux-pro-max/scripts/search.py "<页面关键词>" --design-system --persist -p "<项目名称>" --page "<页面名>"
```

这会创建 `design-system/pages/<页面名>.md`，该页面的规则覆盖 `design-system/MASTER.md`。

实现具体页面时，优先读取页面级文件，它不存在时用 MASTER.md。

### 阶段 4：代码实现（frontend-design）

将设计系统输出作为设计规范，传递给 frontend-design 进行代码实现。

**实现时必须遵守：**

1. **色彩**：严格使用设计系统指定的色板。CSS 变量命名要反映语义（`--color-primary`、`--color-surface`）而非具体色值
2. **字体**：使用设计系统指定的字体搭配（含 Google Fonts import 或 npm 包）
3. **风格**：遵循设计系统推荐的 UI 风格，如 glassmorphism / minimalism / bento grid 等
4. **布局模式**：遵循设计系统推荐的布局结构（hero 类型、内容分区、CTA 位置等）
5. **避免反模式**：严格遵守设计系统列出的反模式清单
6. **创意空间**：在以上约束内，frontend-design 仍可以发挥——选择独特的排版细节、微交互、背景纹理、动画编排等

对每个页面：
1. 读取 `design-system/MASTER.md`（全局规范）
2. 读取 `design-system/pages/<page>.md`（如果存在，覆盖全局规范）
3. 调用 frontend-design，以设计系统为上下文，产出该页面代码

### 阶段 5：检查清单

代码完成后，对照 ui-ux-pro-max 的 Pre-Delivery Checklist 逐项验证：
- 色彩对比度 ≥ 4.5:1
- 焦点状态可见
- `prefers-reduced-motion` 已处理
- 响应式断点 375/768/1024/1440px
- 无 emoji 当图标使用
- 交互元素有 `cursor-pointer`
- hover 状态不造成布局偏移

## 示例

**用户请求：** "帮我做一个美容 SPA 的 landing page，用 React + Tailwind"

### 阶段 1 — 分析
> 产品：美容/SPA 服务 | 风格：优雅、柔和、专业 | 技术栈：React + Tailwind | 单页面

### 阶段 2 — 设计系统
```bash
python .claude/skills/ui-ux-pro-max/scripts/search.py "beauty spa wellness service elegant" --design-system -p "Serenity Spa"
```

### 阶段 3 — 跳过（单页面无需 persist）

### 阶段 4 — 代码实现
基于设计系统输出，调用 frontend-design 生成 React + Tailwind 代码。

### 阶段 5 — 检查清单验证
