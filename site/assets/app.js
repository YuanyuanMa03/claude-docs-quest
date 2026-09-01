/* Claude Code 任务卷轴 —— 游戏化文档阅读器
   数据：../docs-data/index.json + 各 .md 文件（构建时复制到 site/data/）
   亮点：任务地图 / XP 等级 / 成就 / 可运行代码块（JS 真实执行 + Bash 模拟终端） */
"use strict";

const $ = s => document.querySelector(s);
const DATA = "data/";

/* ---------- 玩家状态（localStorage 持久化） ---------- */
const SAVE_KEY = "ccq_save_v1";
let save = Object.assign(
  { xp: 0, coins: 0, read: {}, achv: {}, lastPage: null },
  JSON.parse(localStorage.getItem(SAVE_KEY) || "{}")
);
const persist = () => localStorage.setItem(SAVE_KEY, JSON.stringify(save));

const LEVELS = ["初心者", "见习编码员", "终端行者", "提示词术士", "Hook 工匠", "子代理召唤师", "MCP 链接大师", "上下文掌控者", "代理编队指挥官", "Claude Code 传奇"];
const xpNeed = lv => lv * 100;
const levelOf = xp => { let lv = 1; while (xp >= xpNeed(lv) && lv < 99) { xp -= xpNeed(lv); lv++; } return [lv, xp]; };

const ACHIEVEMENTS = {
  first_read:  ["📖 初次冒险", "读完第一篇文档"],
  five_read:   ["🗺️ 探索者", "读完 5 篇文档"],
  twenty_read: ["📚 卷轴收藏家", "读完 20 篇文档"],
  all_read:    ["👑 全知者", "读完所有文档"],
  coder:       ["⚡ 代码实践者", "在 playground 里运行过代码"],
  bash:        ["🖥️ 终端幻想", "运行过模拟终端命令"],
  rich:        ["🪙 小富即安", "持有 500 金币"],
};

function grantAchv(id) {
  if (save.achv[id]) return;
  save.achv[id] = Date.now();
  const [name, desc] = ACHIEVEMENTS[id];
  showAchv(`${name}<br><small style="color:var(--dim)">${desc}</small>`);
  persist();
}
function showAchv(html) {
  const d = document.createElement("div");
  d.className = "achv-item"; d.innerHTML = "🏆 成就解锁<br>" + html;
  $("#achv").appendChild(d);
  setTimeout(() => d.remove(), 5000);
}
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}
function addXp(n) {
  const [lv0] = levelOf(save.xp);
  save.xp += n; save.coins += n;
  const [lv1, cur] = levelOf(save.xp);
  if (lv1 > lv0) { toast(`✨ 等级提升！LV ${lv1} · ${LEVELS[Math.min(lv1 - 1, LEVELS.length - 1)]}`); save.coins += 50; }
  if (save.coins >= 500) grantAchv("rich");
  persist(); renderHud();
}
function renderHud() {
  const [lv, cur] = levelOf(save.xp), need = xpNeed(lv);
  $("#xpbar i").style.width = (cur / need * 100) + "%";
  $("#xpbar b").textContent = `LV ${lv} · ${cur}/${need} XP`;
  $("#lv").textContent = `${LEVELS[Math.min(lv - 1, LEVELS.length - 1)]}`;
  $("#coins").textContent = `🪙 ${save.coins}`;
}

/* ---------- 数据 ---------- */
let INDEX = null;
const bySlug = {};
async function loadIndex() {
  const r = await fetch(DATA + "index.json");
  INDEX = await r.json();
  INDEX.pages.forEach(p => bySlug[p.slug] = p);
}

/* ---------- 侧边栏（任务地图导航） ---------- */
function renderSide(activeSlug) {
  const sections = {};
  INDEX.pages.forEach(p => (sections[p.section] = sections[p.section] || []).push(p));
  const icons = { done: "✅", reading: "🔵", todo: "🔸" };
  $("#side").innerHTML = Object.entries(sections).map(([sec, pages]) => {
    const doneN = pages.filter(p => save.read[p.slug]).length;
    return `<details ${activeSlug && pages.some(p => p.slug === activeSlug) ? "open" : ""}>
      <summary>${sec} <small style="color:var(--ok)">${doneN}/${pages.length}</small></summary>
      ${pages.map(p => `<a class="q ${p.slug === activeSlug ? "active" : ""}" href="#/page/${p.slug}">
        <span class="st">${save.read[p.slug] === "done" ? icons.done : icons.todo}</span>${p.title}</a>`).join("")}
    </details>`;
  }).join("");
}

/* ---------- 首页：任务地图 ---------- */
function renderHome() {
  const sections = {};
  INDEX.pages.forEach(p => (sections[p.section] = sections[p.section] || []).push(p));
  const readN = Object.values(save.read).filter(v => v === "done").length;
  $("#main").innerHTML = `
    <h1 style="font-size:1.6rem">🗺️ Claude Code 大陆冒险地图</h1>
    <p style="color:var(--dim)">欢迎回来，${LEVELS[Math.min(levelOf(save.xp)[0] - 1, LEVELS.length - 1)]}！
      你已点亮 <b style="color:var(--gold)">${readN}</b> / ${INDEX.pages.length} 张卷轴。
      每读完一篇文档获得 XP 与金币；代码块可以直接 <b style="color:var(--cyan)">编辑并运行</b>。</p>
    <p style="font-family:var(--font-pixel);font-size:.75rem;color:var(--dim)">最近同步：${INDEX.generated} · 自动抓取自官方文档</p>
    ${Object.entries(sections).map(([sec, pages]) => `
      <div class="map-section">◆ ${sec} —— ${pages.filter(p => save.read[p.slug] === "done").length}/${pages.length}</div>
      <div class="map-grid">${pages.map((p, i) => `
        <div class="quest-card ${save.read[p.slug] === "done" ? "" : ""}" onclick="location.hash='#/page/${p.slug}'">
          <span class="badge ${save.read[p.slug] === "done" ? "done" : ""}">${save.read[p.slug] === "done" ? "已通关" : "待探索"}</span>
          <div class="rune">${["⚔️","🛡️","📜","🔮","🧪","🗝️","🌌","🧭"][i % 8]}</div>
          <h3>${p.title}</h3>
          <div class="desc">${(p.description || "").slice(0, 90)}</div>
        </div>`).join("")}</div>`).join("")}
    <h2 style="margin-top:3rem">🏆 成就墙</h2>
    <div class="map-grid">${Object.entries(ACHIEVEMENTS).map(([id, [name, desc]]) => `
      <div class="quest-card" style="cursor:default;${save.achv[id] ? "" : "filter:grayscale(1);opacity:.5"}">
        <div class="rune">${save.achv[id] ? "🏆" : "🔒"}</div><h3>${name}</h3><div class="desc">${desc}</div>
      </div>`).join("")}</div>`;
  renderSide(null);
}

/* ---------- 代码块：编辑 + 运行 ---------- */
const BASH_SIM = {
  "claude --version": "1.0.108 (Claude Code)",
  "claude": "✻ Welcome to Claude Code!\n\n  /exit 获取帮助，随时按 Esc 中断\n\nTips: 运行 /init 让 Claude 分析你的代码库并生成 CLAUDE.md",
  "npm install -g @anthropic-ai/claude-code": "added 1 package in 12s",
  "claude -p \"hello\"": "你好！我是 Claude Code，一个代理式编码助手。",
  "pwd": "/home/adventurer/quest",
  "ls": "src  CLAUDE.md  package.json  .claude/",
  "whoami": "adventurer",
  "date": new Date().toString(),
};
function runBash(code) {
  const lines = [];
  for (const line of code.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) { lines.push(line); continue; }
    const base = t.replace(/["'].*$/, "").trim();
    const hit = Object.keys(BASH_SIM).find(k => base === k || base.startsWith(k.split(" ")[0] + " ") && BASH_SIM[k] && base.length <= k.length + 2);
    lines.push(`$ ${t}\n${BASH_SIM[base] || BASH_SIM[hit] || `⚡ 模拟终端：${t}\n（这是浏览器内的趣味模拟，非真实执行。试试 claude --version / ls / pwd）`}`);
  }
  return lines.join("\n");
}
const JS_LANGS = new Set(["js", "javascript", "node", "ts", "typescript"]);
const SIM_LANGS = new Set(["bash", "sh", "shell", "zsh"]);
function makeRunnable(pre, lang) {
  const code = pre.textContent;
  const box = document.createElement("div");
  box.className = "cm-block";
  const kind = JS_LANGS.has(lang) ? "🟢 浏览器真实执行" : SIM_LANGS.has(lang) ? "🖥️ 模拟终端" : "📋 可编辑";
  box.innerHTML = `
    <div class="cm-head"><span>▸ ${lang || "code"} · ${kind}</span>
      <button class="btn primary" style="padding:.15rem .6rem">▶ 运行</button></div>
    <textarea spellcheck="false"></textarea>
    <div class="cm-out"></div>`;
  box.querySelector("textarea").value = code;
  const out = box.querySelector(".cm-out");
  box.querySelector("button").onclick = () => {
    const src = box.querySelector("textarea").value;
    out.style.display = "block";
    if (SIM_LANGS.has(lang)) {
      out.textContent = runBash(src); grantAchv("bash");
    } else if (JS_LANGS.has(lang)) {
      const logs = [];
      const fmt = v => { try { return typeof v === "object" ? JSON.stringify(v) : String(v); } catch { return String(v); } };
      const fakeConsole = {
        log: (...a) => logs.push(a.map(fmt).join(" ")),
        error: (...a) => logs.push("❌ " + a.map(fmt).join(" ")),
        warn: (...a) => logs.push("⚠️ " + a.map(fmt).join(" ")),
      };
      let fn;
      try { fn = new Function("console", `"use strict";return (async()=>{\n${src}\n})()`); }
      catch (e) { out.textContent = "❌ 语法错误: " + e.message; grantAchv("coder"); return; }
      Promise.resolve(fn(fakeConsole)).then(
        r => { if (r !== undefined) logs.push("→ " + fmt(r)); out.textContent = logs.join("\n") || "（无输出）"; },
        e => { logs.push("❌ " + (e && e.message || e)); out.textContent = logs.join("\n"); }
      );
      grantAchv("coder"); addXp(3);
    } else {
      out.textContent = "⚡ 该语言需要在本地环境运行（如 " + (lang || "此代码") + "）。代码已可编辑，可复制到终端 / 编辑器中实践；编辑后点「运行」可再次查看此提示。";
    }
  };
  pre.replaceWith(box);
}

/* ---------- 文档渲染 ---------- */
const MDX_REPLACERS = [
  [/^> ## .*$/gm, ""],                                  // Mintlify 索引头
  [/<(Note|Info|Tip|Warning|Check)>([\s\S]*?)<\/\1>/g, (m, tag, body) => `> **${{Note:"📝 指南",Info:"ℹ️ 说明",Tip:"💡 技巧",Warning:"⚠️ 注意",Check:"✅ 检查"}[tag]}** ${body.trim()}`],
  [/<Tab title="([^"]*)"[^>]*>/g, '\n**🏷️ $1**\n'],
  [/<Accordion title="([^"]*)"[^>]*>/g, '\n**📁 $1**\n'],
  [/<\/?(AccordionGroup|Accordion|Tab|Tabs|TabGroup|TabPanel|Card|CardGroup|Frame|Steps|Step|Example)[^>]*>/g, ""],
  [/^<h2 id="([^"]+)">\s*$/gm, "## "],
  [/^<\/h2>$/gm, ""],
];

/* Mintlify 容器（Tabs/Accordion）内的内容带缩进，需反缩进才能被 markdown 正确解析。
   围栏代码块内部按围栏的缩进统一反缩进，保留代码相对缩进。 */
function dedentMdx(md) {
  const out = [];
  let fence = null; // 记录围栏缩进
  for (const line of md.split("\n")) {
    const ind = line.match(/^\s*/)[0].length;
    const m = line.trim().match(/^(```|~~~)/);
    if (fence !== null) {
      out.push(ind >= fence ? line.slice(fence) : line);
      if (m) fence = null; // 闭合围栏
    } else if (m) {
      fence = ind;
      out.push(line.slice(ind));
    } else if (/^\S/.test(line) || ind < 4) {
      out.push(line);
    } else {
      out.push(line.replace(/^(?: {4})+/, "")); // 循环去掉每 4 空格
    }
  }
  return out.join("\n");
}
async function renderPage(slug) {
  const p = bySlug[slug];
  if (!p) { $("#main").innerHTML = "<h1>404 · 卷轴遗失</h1><p><a href='#/'>返回地图</a></p>"; return; }
  const r = await fetch(DATA + p.file);
  let md = await r.text();
  MDX_REPLACERS.forEach(([re, to]) => md = md.replace(re, to));
  md = dedentMdx(md);

  $("#main").innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
      <small style="color:var(--dim);font-family:var(--font-pixel)">🗺️ ${p.section} ${p.locale === "en" ? "· EN 回退" : ""}</small>
      <button class="btn primary" id="finish">⚔️ 通关本卷轴 +20 XP</button>
    </div>
    <article class="doc" id="doc"></article>
    <div style="display:flex;justify-content:space-between;margin-top:1rem">
      <button class="btn" id="prev">← 上一卷轴</button>
      <button class="btn" id="next">下一卷轴 →</button>
    </div>`;
  $("#doc").innerHTML = marked.parse(md);
  $("#doc").querySelectorAll("a[href^='http']").forEach(a => a.target = "_blank");
  $("#doc").querySelectorAll("pre code").forEach(c => {
    const m = c.className.match(/language-(\w+)/);
    makeRunnable(c.parentElement, m ? m[1].toLowerCase() : "");
  });
  $("#finish").onclick = () => {
    if (save.read[slug] === "done") return toast("本卷轴已通关过啦 ✅");
    save.read[slug] = "done";
    const n = Object.values(save.read).filter(v => v === "done").length;
    grantAchv("first_read"); if (n >= 5) grantAchv("five_read");
    if (n >= 20) grantAchv("twenty_read");
    if (n >= INDEX.pages.length) grantAchv("all_read");
    addXp(20); toast("⚔️ 通关！+20 XP +20 🪙"); renderSide(slug);
  };
  const i = INDEX.pages.findIndex(x => x.slug === slug);
  const nav = d => { const q = INDEX.pages[i + d]; if (q) location.hash = "#/page/" + q.slug; };
  $("#prev").onclick = () => nav(-1); $("#next").onclick = () => nav(1);
  save.lastPage = slug; persist();
  renderSide(slug); window.scrollTo(0, 0);
}

/* ---------- 路由 ---------- */
function route() {
  const h = location.hash;
  const m = h.match(/^#\/page\/(.+)$/);
  if (m) renderPage(decodeURIComponent(m[1]));
  else renderHome();
}
const toggleSide = () => $("#side").classList.toggle("open");

(async function init() {
  await loadIndex();
  window.addEventListener("hashchange", route);
  route(); renderHud();
  if (!save.visited) { save.visited = 1; persist(); toast("🎮 欢迎来到 Claude Code 大陆！点击卷轴开始冒险"); }
})();
