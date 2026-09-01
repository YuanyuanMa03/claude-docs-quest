#!/usr/bin/env python3
"""
Claude Code 官方文档持续抓取器
- 从 https://code.claude.com/docs/llms.txt 获取全部页面索引
- 将英文 URL 映射为 zh-CN，逐页抓取 Markdown（.md 端点）
- 输出到 docs-data/：每页一个 .md 文件 + index.json 索引
仅使用标准库，可直接在 GitHub Actions 中运行。
"""
import json
import re
import sys
import time
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

BASE = "https://code.claude.com"
LLMS_URL = BASE + "/docs/llms.txt"
LOCALE = "zh-CN"          # 抓取语言；页面未翻译（404）时回退英文
FALLBACK_EN = True
OUT_DIR = Path(__file__).resolve().parent.parent / "docs-data"
DELAY = 0.4               # 抓取间隔（秒），礼貌性限速
UA = "claude-docs-quest-crawler/1.0 (+https://github.com/; docs mirror)"

ENTRY_RE = re.compile(r"^- \[(.+?)\]\((https://code\.claude\.com/docs/en/[^)]+\.md)\)(?::\s*(.*))?$", re.M)


def fetch(url: str, retries: int = 3) -> str | None:
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read().decode("utf-8")
        except Exception as e:
            if i == retries - 1:
                print(f"  ! fail {url}: {e}", file=sys.stderr)
                return None
            time.sleep(2 * (i + 1))


def parse_index(text: str):
    """解析 llms.txt：返回 [(title, slug, section, description, order)]"""
    pages, section, seen = [], None, set()
    for line in text.splitlines():
        if line.startswith("## ") and not line.startswith("### "):
            section = line[3:].strip()
        m = ENTRY_RE.match(line)
        if not m:
            continue
        title, url, desc = m.group(1), m.group(2), (m.group(3) or "").strip()
        slug = urlparse(url).path.replace("/docs/en/", "").removesuffix(".md")
        if slug in seen:
            continue
        seen.add(slug)
        pages.append({
            "title": title,
            "slug": slug,
            "section": section or "Docs",
            "description": desc,
            "order": len(pages),
        })
    return pages


def local_url_repl(md: str) -> str:
    """将页面内 /docs/zh-CN/... 链接改写为站内 #/page/... 路由，英文链接映射为 zh-CN。"""
    def repl(m):
        path = m.group(1)
        path = re.sub(r"^/docs/(?:en/)?", "", path)
        path = path.split("#")[0].rstrip("/")
        return f"#/page/{path}" if path else m.group(0)
    return re.sub(r"\]\(/docs/(?:en|zh-CN)/([^)#\s]+)\)", repl, md)


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    llms = fetch(LLMS_URL)
    if not llms:
        sys.exit("无法获取 llms.txt 索引")
    pages = parse_index(llms)
    print(f"索引解析出 {len(pages)} 个页面")

    index, failed = [], 0
    for p in pages:
        slug, fname = p["slug"], p["slug"].replace("/", "__") + ".md"
        url = f"{BASE}/docs/{LOCALE}/{slug}.md"
        md = fetch(url)
        locale = LOCALE
        if md is None and FALLBACK_EN:
            md = fetch(f"{BASE}/docs/en/{slug}.md")
            locale = "en"
        if md is None:
            failed += 1
            continue
        md = local_url_repl(md)
        (OUT_DIR / fname).write_text(md, encoding="utf-8")
        index.append({**p, "file": fname, "locale": locale,
                      "words": len(md), "hash": hash(md) & 0xFFFFFFFF,
                      "updated": time.strftime("%Y-%m-%d")})
        print(f"  ✓ [{locale}] {slug}")
        time.sleep(DELAY)

    (OUT_DIR / "index.json").write_text(
        json.dumps({"generated": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "source": LLMS_URL, "locale": LOCALE, "count": len(index),
                    "pages": index}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"完成：{len(index)} 成功，{failed} 失败")
    sys.exit(1 if failed > len(pages) * 0.2 else 0)  # 失败过多视为异常


if __name__ == "__main__":
    main()
