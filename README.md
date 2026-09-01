# ⚡ Claude Code 任务卷轴 (claude-docs-quest)

将 [Claude Code 官方中文文档](https://code.claude.com/docs/zh-CN/overview) 变成一场游戏化冒险：
任务地图、XP 等级、金币、成就系统，文档中的代码块可直接编辑并运行（JavaScript 真实执行 / Bash 趣味模拟终端）。

## ✨ 特性

- 🗺️ **任务地图** — 文档按章节组织为「关卡」，侧边栏显示通关进度
- ⚔️ **通关奖励** — 读完后点击「通关本卷轴」获得 XP / 金币，自动升级（初心者 → Claude Code 传奇）
- 🏆 **成就墙** — 7 个成就（初次冒险、探索者、全知者、代码实践者……），进度存于浏览器 localStorage
- ▶️ **可运行代码块** — 每个代码块都是编辑器：
  - `javascript` 等在浏览器中**真实执行**，console 输出实时回显
  - `bash` 在**模拟终端**中运行（趣味演示，不触真实系统）
- 🤖 **GitHub Actions 全自动** — 每天定时抓取官方文档，有更新自动提交并重新部署 GitHub Pages

## 📁 结构

```
crawler/crawl.py          # 抓取器：llms.txt 索引 → 逐页抓 zh-CN markdown（无第三方依赖）
docs-data/                # 抓取结果（每页一个 .md + index.json）
site/                     # 纯静态游戏化阅读站（零构建，marked.js CDN）
.github/workflows/        # 定时抓取 + Pages 部署
```

## 🚀 使用

### 本地运行
```bash
python3 crawler/crawl.py            # 抓取最新文档
mkdir -p site/data && cp docs-data/* site/data/
cd site && python3 -m http.server 8000
```
打开 http://localhost:8000

### 部署到 GitHub Pages
1. 新建仓库并推送本项目
2. 仓库 Settings → Pages → Source 选择 **GitHub Actions**
3. 手动触发 workflow（Actions → 抓取文档并部署 → Run workflow），此后每天自动同步

## 📄 说明

- 数据来自官方公开的 `.md` 端点（`/docs/zh-CN/<page>.md`），未翻译页面自动回退英文并在页面标注
- 仅供学习交流，版权归原作者所有
