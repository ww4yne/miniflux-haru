// ============================================================
// Miniflux 自定义 JS
//   1. 列表条目首字母图标
//   2. 主题探测 mf-dark / mf-light
//   3. 把原生「标记本页为已读」搬进底部分页行
//   4. 「回到列表」按钮（仅条目详情页）
//   5. 点击文章 = 自动标记上方未读为已读
//   6. 阅读模式 DOM 兜底
// ============================================================

const ready = fn => document.body ? fn() : addEventListener("DOMContentLoaded", fn);
const onRoute = fn => {
  const sched = () => requestAnimationFrame(() => requestAnimationFrame(fn));
  for (const k of ["pushState", "replaceState"]) {
    const orig = history[k];
    history[k] = function (...a) { orig.apply(this, a); sched(); };
  }
  addEventListener("popstate", sched);
};

// ---------------- 1. 列表首字母图标 ----------------
ready(() => {
  for (const a of document.querySelectorAll("article.entry-item")) {
    if (a.dataset.iconChecked) continue;
    a.dataset.iconChecked = "1";
    const link = a.querySelector(".item-title a");
    const src = a.querySelector(".item-meta-info-title a")?.textContent.trim();
    if (link && src) link.dataset.iconLetter = src[0];
  }
});

// ---------------- 2. 主题探测 ----------------
ready(() => {
  const mql = matchMedia("(prefers-color-scheme: dark)");
  const update = () => {
    const el = document.querySelector(".header");
    const m = el && getComputedStyle(el).backgroundColor.match(/\d+/g);
    const dark = (m && m.length >= 3 && m[3] !== "0")
      ? (+m[0] + +m[1] + +m[2]) / 3 < 128
      : mql.matches;
    const cl = document.documentElement.classList;
    cl.toggle("mf-dark", dark);
    cl.toggle("mf-light", !dark);
  };
  update();
  mql.addEventListener("change", update);
});

// ---------------- 3. 「标记本页为已读」搬到底部分页行 ----------------
ready(() => {
  const btn = document.querySelector('.page-footer [data-action="markPageAsRead"]');
  if (!btn || btn.dataset.mfRelocated) return;
  const pagers = document.querySelectorAll(".pagination");
  const bottom = pagers[pagers.length - 1];
  if (!bottom) return;
  btn.dataset.mfRelocated = "1";
  const right = bottom.querySelector(":scope > .pagination-next, :scope > .pagination-forward");
  const wrap = document.createElement("div");
  wrap.className = "mf-mark-page-wrap";
  wrap.style.cssText = "flex:1;display:flex;justify-content:center";
  wrap.appendChild(btn);
  bottom.insertBefore(wrap, right || null);
});

// ---------------- 4. 「回到列表」按钮 ----------------
const injectBack = () => {
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
ready(injectBack);
onRoute(injectBack);

// ---------------- 5. 点击文章 = 标记上方未读 ----------------
ready(() => {
  if (!document.querySelector("article.entry-item")) return;
  document.addEventListener("click", e => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const link = e.target.closest("article.entry-item .item-title a");
    if (!link) return;
    const target = link.closest("article[data-id]");
    const all = [...document.querySelectorAll("article.entry-item")];
    const idx = all.indexOf(target);
    if (idx <= 0) return;
    const ids = all.slice(0, idx)
      .filter(a => a.classList.contains("item-status-unread"))
      .map(a => +a.dataset.id);
    if (!ids.length) return;
    fetch("/entry/status", {
      method: "POST",
      credentials: "same-origin",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        "X-Csrf-Token": document.body.dataset.csrfToken || "",
      },
      body: JSON.stringify({ entry_ids: ids, status: "read" }),
    });
  }, true);
});

// ---------------- 6. 阅读模式 DOM 兜底 ----------------
const STYLE_KILL = /(?:^|;)\s*(?:color|background[\w-]*|font[\w-]*|margin[\w-]*|padding[\w-]*|line-height|text-align|text-indent)\s*:[^;]*/gi;
const EMOJI = /[\u{2300}-\u{23FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F000}-\u{1FAFF}\uFE0F\u200D]+/gu;
const MERGE_TAGS = /^(P|H[1-6]|LI)$/;
const ICON_CSS = "display:inline!important;max-width:1.2em!important;max-height:1.2em!important;width:auto!important;height:auto!important;margin:0 4px 0 0!important;vertical-align:-0.15em!important";
const EMOJI_IMG_SEL = "img.emoji,img.smiley,img.twemoji,img.emojione,img.wp-smiley,img.custom-emoji";

const mergeIntoNext = (node, par) => {
  const nxt = par.nextElementSibling;
  if (nxt && MERGE_TAGS.test(nxt.tagName)) nxt.insertBefore(node, nxt.firstChild);
  par.remove();
};

const clean = () => {
  if (!/\/entry\/\d+/.test(location.pathname)) return;
  const root = document.querySelector(".entry-content");
  if (!root || root.dataset.cleaned) return;
  root.dataset.cleaned = "1";

  for (const img of root.querySelectorAll(EMOJI_IMG_SEL)) img.remove();

  for (const el of root.querySelectorAll("[style]")) {
    const s = el.getAttribute("style").replace(STYLE_KILL, "").replace(/^;+|;+$/g, "").trim();
    s ? el.setAttribute("style", s) : el.removeAttribute("style");
  }

  for (const p of root.querySelectorAll("p")) {
    const t = p.textContent.trim();
    const hasMedia = p.querySelector("img,video,iframe");
    if (!t && !hasMedia) { p.remove(); continue; }
    if (!t || hasMedia || p.querySelector("a")) continue;
    if (!t.replace(EMOJI, "").trim()) {
      const nxt = p.nextElementSibling;
      if (nxt && MERGE_TAGS.test(nxt.tagName)) {
        nxt.insertBefore(document.createTextNode(t + " "), nxt.firstChild);
        p.remove();
      }
    }
  }

  for (const img of root.querySelectorAll("img")) {
    const post = () => {
      const w = img.naturalWidth, h = img.naturalHeight;
      if (!w || !h) return;
      if (w >= 800 && w / h >= 3) {
        img.style.setProperty("max-width", "60%", "important");
        return;
      }
      if (w <= 128 && w === h) {
        img.style.cssText += ";" + ICON_CSS;
        const par = img.closest("p");
        if (par && par.children.length === 1 && !par.textContent.trim()) mergeIntoNext(img, par);
      }
    };
    if (img.complete && img.naturalWidth) post();
    else {
      img.addEventListener("load", post, { once: true });
      img.addEventListener("error", () => {
        const par = img.closest("p");
        if (par && par.children.length === 1 && !par.textContent.trim()) par.remove();
      }, { once: true });
    }
  }
};
ready(clean);
onRoute(clean);
