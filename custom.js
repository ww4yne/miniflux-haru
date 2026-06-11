// ============================================================
// Miniflux 自定义 JS
//   1. 列表条目首字母图标
//   2. 主题探测 mf-dark / mf-light
//   3. 把原生「标记本页为已读」搬进底部分页行
//   4. 「回到列表」按钮（仅条目详情页）
//   5. 点击文章 = 自动标记上方未读为已读
// ============================================================

// ---------------- 1. 列表条目首字母图标 ----------------
(() => {
  const sweep = () => {
    for (const a of document.querySelectorAll("article.entry-item")) {
      if (a.dataset.iconChecked) continue;
      a.dataset.iconChecked = "1";
      const link = a.querySelector(".item-title a");
      const src = a.querySelector(".item-meta-info-title a")?.textContent.trim();
      if (link && src) link.dataset.iconLetter = src[0];
    }
  };
  document.body ? sweep() : addEventListener("DOMContentLoaded", sweep);
})();

// ---------------- 2. 主题探测 ----------------
(() => {
  const update = () => {
    const el = document.querySelector(".header");
    const m = el && getComputedStyle(el).backgroundColor.match(/\d+/g);
    const dark = (m && m.length >= 3 && m[3] !== "0")
      ? (+m[0] + +m[1] + +m[2]) / 3 < 128
      : matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("mf-dark", dark);
    document.documentElement.classList.toggle("mf-light", !dark);
  };
  const start = () => {
    update();
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", update);
  };
  document.body ? start() : addEventListener("DOMContentLoaded", start);
})();

// ---------------- 3. 把原生「标记本页为已读」搬进底部分页行 ----------------
(() => {
  const move = () => {
    const btn = document.querySelector('.page-footer [data-action="markPageAsRead"]');
    if (!btn || btn.dataset.mfRelocated) return;
    const pagers = document.querySelectorAll(".pagination");
    const bottomPager = pagers[pagers.length - 1];
    if (!bottomPager) return;
    btn.dataset.mfRelocated = "1";
    const right = bottomPager.querySelector(
      ":scope > .pagination-next, :scope > .pagination-forward");
    const wrap = document.createElement("div");
    wrap.className = "mf-mark-page-wrap";
    wrap.style.cssText = "flex:1;display:flex;justify-content:center";
    wrap.appendChild(btn);
    bottomPager.insertBefore(wrap, right || null);
  };
  document.body ? move() : addEventListener("DOMContentLoaded", move);
})();

// ---------------- 4. 「回到列表」按钮（仅条目详情页） ----------------
(() => {
  const inject = () => {
    if (!/\/entry\/\d+/.test(location.pathname)) return;
    document.querySelectorAll(".pagination").forEach((pager, i) => {
      const id = `mf-back-btn-${i}`;
      if (document.getElementById(id)) return;
      const next = pager.querySelector(".pagination-next");
      if (!next) return;
      const wrap = document.createElement("div");
      wrap.style.cssText = "flex:1;display:flex;justify-content:center";
      wrap.appendChild(Object.assign(document.createElement("a"), {
        id, href: "/unread", textContent: "回到列表",
      }));
      pager.insertBefore(wrap, next);
    });
  };
  const schedule = () =>
    requestAnimationFrame(() => requestAnimationFrame(inject));
  for (const k of ["pushState", "replaceState"]) {
    const orig = history[k];
    history[k] = function (...a) { orig.apply(this, a); schedule(); };
  }
  addEventListener("popstate", schedule);
  document.body ? inject() : addEventListener("DOMContentLoaded", inject);
})();

// ---------------- 5. 点击文章 = 自动标记上方未读 ----------------
// 列表页点条目标题时，把当前 DOM 顺序中位于该文之前的所有未读 POST 标为已读。
// 排序无关：读 DOM 顺序，与用户当前排序设置一致。
(() => {
  const csrf = () => document.body.dataset.csrfToken || "";
  const onClick = e => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const link = e.target.closest("article.entry-item .item-title a");
    if (!link) return;
    const target = link.closest("article[data-id]");
    if (!target) return;
    const all = [...document.querySelectorAll("article.entry-item")];
    const idx = all.indexOf(target);
    if (idx <= 0) return;
    const above = all.slice(0, idx).filter(a =>
      a.classList.contains("item-status-unread"));
    if (!above.length) return;
    const ids = above.map(a => +a.dataset.id);
    fetch("/entry/status", {
      method: "POST",
      credentials: "same-origin",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        "X-Csrf-Token": csrf(),
      },
      body: JSON.stringify({ entry_ids: ids, status: "read" }),
    });
  };
  if (document.querySelector("article.entry-item")) {
    document.addEventListener("click", onClick, true);
  }
})();

// ---------------- 6. 阅读模式 DOM 兜底（详情页，直订脏 source）----------------
(() => {
  const STYLE_KILL = /(?:^|;)\s*(?:color|background[\w-]*|font[\w-]*|margin[\w-]*|padding[\w-]*|line-height|text-align|text-indent)\s*:[^;]*/gi;
  const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{2700}-\u{27BF}\uFE0F\u200D]+/gu;
  const EMOJI_IMG_CLS = /\b(emoji|smiley|twemoji|emojione|wp-smiley|custom-emoji)\b/i;
  const clean = () => {
    if (!/\/entry\/\d+/.test(location.pathname)) return;
    const root = document.querySelector(".entry-content");
    if (!root || root.dataset.cleaned) return;
    root.dataset.cleaned = "1";
    // 删图片型 emoji
    for (const img of root.querySelectorAll("img")) {
      if (EMOJI_IMG_CLS.test(img.className)) img.remove();
    }
    // 剥 inline style 污染
    for (const el of root.querySelectorAll("[style]")) {
      const s = el.getAttribute("style").replace(STYLE_KILL, "").replace(/^;+|;+$/g, "").trim();
      if (s) el.setAttribute("style", s); else el.removeAttribute("style");
    }
    // 删空 p
    for (const p of root.querySelectorAll("p")) {
      if (!p.textContent.trim() && !p.querySelector("img,video,iframe")) p.remove();
    }
    // 删 text 节点里的 unicode emoji（跳过 pre/code 子树）
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: n => n.parentNode.closest("pre, code")
        ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    const txts = [];
    for (let n; n = walker.nextNode();) txts.push(n);
    for (const n of txts) {
      if (EMOJI.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(EMOJI, "");
    }
  };
  const schedule = () => requestAnimationFrame(() => requestAnimationFrame(clean));
  document.body ? clean() : addEventListener("DOMContentLoaded", clean);
  for (const k of ["pushState", "replaceState"]) {
    const orig = history[k];
    history[k] = function (...a) { orig.apply(this, a); schedule(); };
  }
  addEventListener("popstate", schedule);
})();