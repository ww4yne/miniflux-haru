// ============================================================
// Miniflux 自定义 JS
//   1. 列表条目首字母图标
//   2. 主题探测 mf-dark / mf-light
//   3. 把原生「标记本页为已读」搬进底部分页行
//   4. 「回到列表」按钮（仅条目详情页）
//   5. 批量标记已读 API
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

// ---------------- 5. 批量标记已读 API ----------------
const markEntriesRead = async ids => {
  const response = await fetch("/entry/status", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "X-Csrf-Token": document.body.dataset.csrfToken || "",
    },
    body: JSON.stringify({ entry_ids: ids, status: "read" }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
};

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

// ---------------- 7. 桌面分栏阅读 ----------------
ready(() => {
  const desktop = matchMedia("(min-width: 1024px)");
  const list = document.querySelector(".items article.entry-item")?.closest(".items");
  const listMain = list?.closest("main");
  const header = document.querySelector(".header");
  const headerMenu = document.querySelector("#header-menu");
  if (!list || !listMain || !header || !headerMenu) return;

  document.body.classList.add("mf-split-active");
  const syncHeaderHeight = () => {
    document.body.style.setProperty("--mf-split-header-height", `${header.offsetHeight}px`);
  };
  syncHeaderHeight();
  addEventListener("resize", syncHeaderHeight);

  const titleHost = Object.assign(document.createElement("section"), {
    id: "mf-split-title",
    className: "entry-header",
  });
  const titleBar = Object.assign(document.createElement("div"), {
    className: "mf-split-title-bar",
  });
  titleHost.appendChild(titleBar);
  const reader = Object.assign(document.createElement("section"), {
    id: "mf-split-reader",
  });
  reader.setAttribute("aria-label", "文章正文");
  const toggle = Object.assign(document.createElement("button"), {
    className: "mf-split-toggle",
    type: "button",
  });
  toggle.setAttribute("aria-expanded", "true");
  const markAbove = Object.assign(document.createElement("button"), {
    className: "mf-mark-above",
    type: "button",
  });
  const markAboveItem = Object.assign(document.createElement("li"), {
    className: "mf-mark-above-item",
  });
  markAboveItem.appendChild(markAbove);
  const inner = Object.assign(document.createElement("div"), {
    className: "mf-split-reader-inner",
  });
  const placeholder = Object.assign(document.createElement("div"), {
    className: "mf-split-placeholder",
    textContent: "选择一篇文章开始阅读",
  });
  inner.appendChild(placeholder);
  reader.appendChild(inner);
  document.body.append(titleHost, reader);

  let request;
  let selectedArticle;
  let cursorArticle;
  const htmlPolicy = globalThis.trustedTypes
    ? trustedTypes.createPolicy("html", { createHTML: html => html })
    : { createHTML: html => html };

  const searchPanel = Object.assign(document.createElement("section"), {
    className: "mf-list-search-panel",
  });
  searchPanel.setAttribute("aria-label", "搜索和筛选已加载的文章");
  const searchInput = Object.assign(document.createElement("input"), {
    className: "mf-list-search-input",
    type: "search",
    placeholder: "搜索文章或来源…",
    autocomplete: "off",
  });
  const filterRow = Object.assign(document.createElement("div"), {
    className: "mf-list-filter-row",
  });
  const filterStatus = Object.assign(document.createElement("span"), {
    className: "mf-list-filter-status",
  });
  let activeFilter = "all";
  for (const [value, label] of [
    ["all", "全部"],
    ["unread", "未读"],
    ["starred", "收藏"],
  ]) {
    const button = Object.assign(document.createElement("button"), {
      className: "mf-list-filter",
      type: "button",
      textContent: label,
    });
    button.dataset.filter = value;
    button.setAttribute("aria-pressed", String(value === activeFilter));
    filterRow.appendChild(button);
  }
  searchPanel.append(searchInput, filterRow, filterStatus);
  document.body.appendChild(searchPanel);

  const articleIsStarred = article =>
    article.querySelector("[data-toggle-starred]")?.dataset.value === "star";
  const applyListFilter = () => {
    const query = searchInput.value.trim().toLocaleLowerCase();
    let visible = 0;
    const articles = [...list.querySelectorAll("article.entry-item")];
    for (const article of articles) {
      const matchesText = !query ||
        article.textContent.toLocaleLowerCase().includes(query);
      const matchesFilter = activeFilter === "all" ||
        (activeFilter === "unread" && article.classList.contains("item-status-unread")) ||
        (activeFilter === "starred" && articleIsStarred(article));
      article.classList.toggle("mf-list-filter-hidden", !(matchesText && matchesFilter));
      if (matchesText && matchesFilter) visible += 1;
    }
    filterStatus.textContent = visible ? `匹配 ${visible} 条` : "没有匹配文章";
  };
  const openSearch = () => {
    searchPanel.classList.add("mf-list-search-open");
    searchInput.focus();
  };
  const closeSearch = () => {
    searchPanel.classList.remove("mf-list-search-open");
    cursorArticle?.focus({ preventScroll: true });
  };
  document.addEventListener("click", event => {
    if (!searchPanel.classList.contains("mf-list-search-open") ||
        searchPanel.contains(event.target)) return;
    searchPanel.classList.remove("mf-list-search-open");
  });
  searchInput.addEventListener("input", applyListFilter);
  filterRow.addEventListener("click", event => {
    const button = event.target.closest(".mf-list-filter");
    if (!button) return;
    activeFilter = button.dataset.filter;
    for (const candidate of filterRow.children) {
      candidate.setAttribute("aria-pressed", String(candidate === button));
    }
    applyListFilter();
  });

  const panelIcon = collapsed => {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const shape = (name, attrs) => {
      const node = document.createElementNS(ns, name);
      for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
      svg.appendChild(node);
    };
    shape("rect", { x: "3", y: "4", width: "18", height: "16", rx: "2" });
    shape("path", { d: "M9 4v16" });
    shape("path", { d: collapsed ? "m13 9 3 3-3 3" : "m16 9-3 3 3 3" });
    return svg;
  };

  const markAboveIcon = () => {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    for (const radius of ["9", "4"]) {
      const circle = document.createElementNS(ns, "circle");
      circle.setAttribute("cx", "12");
      circle.setAttribute("cy", "12");
      circle.setAttribute("r", radius);
      svg.appendChild(circle);
    }
    return svg;
  };
  markAbove.appendChild(markAboveIcon());

  const toolbarIcon = paths => {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    for (const pathData of paths) {
      const path = document.createElementNS(ns, "path");
      path.setAttribute("d", pathData);
      svg.appendChild(path);
    }
    return svg;
  };
  const toolbarButton = (className, label, paths) => {
    const button = Object.assign(document.createElement("button"), {
      className: `mf-reader-toolbar-button ${className}`,
      type: "button",
      disabled: true,
    });
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
    button.appendChild(toolbarIcon(paths));
    return button;
  };
  const previousButton = toolbarButton(
    "mf-reader-previous",
    "上一篇 (K)",
    ["m14 6-6 6 6 6"],
  );
  const nextButton = toolbarButton(
    "mf-reader-next",
    "下一篇 (J)",
    ["m10 6 6 6-6 6"],
  );
  const readButton = toolbarButton(
    "mf-reader-read",
    "切换已读状态 (M)",
    ["M20 11a8 8 0 1 1-3-6", "m9 11 2 2 4-5"],
  );
  const starButton = toolbarButton(
    "mf-reader-star",
    "收藏 (S)",
    ["m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"],
  );
  const originalButton = toolbarButton(
    "mf-reader-original",
    "查看原文",
    ["M14 4h6v6", "m20 4-9 9", "M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"],
  );
  const navigationGroup = Object.assign(document.createElement("div"), {
    className: "mf-reader-toolbar-group",
  });
  const actionGroup = Object.assign(document.createElement("div"), {
    className: "mf-reader-toolbar-group",
  });
  const toolbarSpacer = Object.assign(document.createElement("span"), {
    className: "mf-reader-toolbar-spacer",
  });
  navigationGroup.append(toggle, previousButton, nextButton);
  actionGroup.append(readButton, starButton, originalButton);
  titleBar.append(navigationGroup, toolbarSpacer, actionGroup);

  const unreadAbove = () => {
    if (!selectedArticle) return [];
    const entries = [...list.querySelectorAll("article.entry-item")];
    const index = entries.indexOf(selectedArticle);
    if (index <= 0) return [];
    return entries.slice(0, index)
      .filter(article => article.classList.contains("item-status-unread"));
  };

  const renderMarkAbove = () => {
    const count = unreadAbove().length;
    const label = count
      ? `将当前条目上方 ${count} 条未读标记为已读并刷新列表`
      : "刷新未读列表";
    markAbove.setAttribute("aria-label", label);
    markAbove.setAttribute("title", label);
  };

  const renderToggle = () => {
    const collapsed = document.body.classList.contains("mf-split-collapsed");
    const label = collapsed ? "显示列表" : "收起列表";
    if (!markAboveItem.isConnected) headerMenu.prepend(markAboveItem);
    toggle.replaceChildren(panelIcon(collapsed));
    toggle.setAttribute("aria-label", label);
    toggle.setAttribute("title", label);
    toggle.setAttribute("aria-expanded", String(!collapsed));
  };

  toggle.addEventListener("click", () => {
    document.body.classList.toggle("mf-split-collapsed");
    renderToggle();
  });
  renderToggle();
  renderMarkAbove();

  const resetReaderToolbar = () => {
    for (const button of [
      previousButton,
      nextButton,
      readButton,
      starButton,
      originalButton,
    ]) {
      button.disabled = true;
      button.classList.remove("mf-reader-toolbar-active");
    }
    originalButton.removeAttribute("data-href");
  };
  const syncReaderToolbar = () => {
    const previous = inner.querySelector('.pagination a[data-page="previous"]');
    const next = inner.querySelector('.pagination a[data-page="next"]');
    const status = inner.querySelector(".entry-header [data-toggle-status]");
    const starred = inner.querySelector(".entry-header [data-toggle-starred]");
    const original = inner.querySelector(".entry-header h1 a[href]");
    previousButton.disabled = !previous;
    nextButton.disabled = !next;
    readButton.disabled = !status;
    starButton.disabled = !starred;
    originalButton.disabled = !original;
    readButton.classList.toggle(
      "mf-reader-toolbar-active",
      status?.dataset.value === "read",
    );
    starButton.classList.toggle(
      "mf-reader-toolbar-active",
      starred?.dataset.value === "star",
    );
    const readLabel = status?.dataset.value === "read" ? "标为未读 (M)" : "标为已读 (M)";
    const starLabel = starred?.dataset.value === "star" ? "取消收藏 (S)" : "收藏 (S)";
    readButton.setAttribute("title", readLabel);
    readButton.setAttribute("aria-label", readLabel);
    starButton.setAttribute("title", starLabel);
    starButton.setAttribute("aria-label", starLabel);
    if (original) originalButton.dataset.href = original.href;
    else originalButton.removeAttribute("data-href");
  };
  const syncSelectedEntryAction = (key, action) => {
    if (selectedArticle) {
      if (key === "m") {
        const unread = action.dataset.value === "unread";
        selectedArticle.classList.toggle("item-status-unread", unread);
        selectedArticle.classList.toggle("item-status-read", !unread);
        const listAction = selectedArticle.querySelector("[data-toggle-status]");
        if (listAction) listAction.dataset.value = action.dataset.value;
      } else {
        const listAction = selectedArticle.querySelector("[data-toggle-starred]");
        if (listAction) listAction.dataset.value = action.dataset.value;
      }
      applyListFilter();
      renderMarkAbove();
    }
    syncReaderToolbar();
  };
  const activateEntryAction = key => {
    const selector = key === "m" ? "[data-toggle-status]" : "[data-toggle-starred]";
    const action = inner.querySelector(`.entry-header ${selector}`);
    if (!action) return;
    const initialValue = action.dataset.value;
    let actionSynced = false;
    const syncAction = () => {
      if (actionSynced) return;
      actionSynced = true;
      syncSelectedEntryAction(key, action);
    };
    const actionObserver = new MutationObserver(() => {
      if (action.dataset.value === initialValue) return;
      actionObserver.disconnect();
      syncAction();
    });
    actionObserver.observe(action, {
      attributes: true,
      attributeFilter: ["data-value"],
    });
    action.click();
    setTimeout(() => {
      actionObserver.disconnect();
      if (action.dataset.value !== initialValue) syncAction();
    }, 3000);
  };
  const loadAdjacentEntry = direction => {
    const link = inner.querySelector(`.pagination a[data-page="${direction}"]`);
    if (!link) return;
    const id = link.pathname.match(/\/entry\/(\d+)/)?.[1];
    const article = id && list.querySelector(`article.entry-item[data-id="${id}"]`);
    load(link.href, article);
  };
  previousButton.addEventListener("click", () => loadAdjacentEntry("previous"));
  nextButton.addEventListener("click", () => loadAdjacentEntry("next"));
  readButton.addEventListener("click", () => activateEntryAction("m"));
  starButton.addEventListener("click", () => activateEntryAction("s"));
  originalButton.addEventListener("click", () => {
    if (originalButton.dataset.href) {
      window.open(originalButton.dataset.href, "_blank", "noopener,noreferrer");
    }
  });
  resetReaderToolbar();

  const actionStatus = Object.assign(document.createElement("div"), {
    className: "mf-split-action-status",
  });
  actionStatus.setAttribute("aria-live", "polite");
  listMain.prepend(actionStatus);
  let actionStatusTimer;
  let syncListViewport = () => {};
  const showActionStatus = (text, isError = false) => {
    clearTimeout(actionStatusTimer);
    actionStatus.textContent = text;
    actionStatus.classList.toggle("mf-split-action-error", isError);
    requestAnimationFrame(syncListViewport);
    if (!isError) {
      actionStatusTimer = setTimeout(() => {
        actionStatus.textContent = "";
        requestAnimationFrame(syncListViewport);
      }, 3000);
    }
  };

  const showMessage = (className, text, detail = "") => {
    titleHost.querySelector("h1")?.remove();
    resetReaderToolbar();
    const message = Object.assign(document.createElement("div"), {
      className,
      textContent: text,
    });
    if (detail) {
      message.append(
        document.createElement("br"),
        Object.assign(document.createElement("small"), {
          textContent: detail,
        }),
      );
    }
    inner.replaceChildren(message);
  };

  const cleanSplitContent = root => {
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

  const load = async (url, article) => {
    request?.abort();
    const controller = new AbortController();
    request = controller;
    reader.setAttribute("aria-busy", "true");
    showMessage("mf-split-placeholder", "正在加载正文…");
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 12000);

    try {
      const response = await fetch(url, {
        credentials: "same-origin",
        signal: controller.signal,
        headers: { "X-Requested-With": "Miniflux-Split-Pane" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const html = htmlPolicy.createHTML(await response.text());
      const page = new DOMParser().parseFromString(html, "text/html");
      const entry = page.querySelector(".entry");
      const content = page.querySelector("main");
      if (!entry || !content?.querySelector(".entry-content")) {
        throw new Error("Entry markup not found");
      }

      inner.replaceChildren(
        document.importNode(entry, true),
        ...[...content.children]
          .filter(node => node !== entry)
          .map(node => document.importNode(node, true)),
      );
      cleanSplitContent(inner.querySelector(".entry-content"));
      inner.querySelectorAll(".pagination").forEach((pager, index) => {
        if (pager.querySelector(".mf-split-back-wrap")) return;
        const next = pager.querySelector(":scope > .pagination-next");
        const wrap = Object.assign(document.createElement("div"), {
          className: "mf-split-back-wrap",
        });
        const back = Object.assign(document.createElement("a"), {
          id: `mf-back-btn-split-${index}`,
          href: location.href,
          textContent: "回到列表",
        });
        back.addEventListener("click", event => {
          event.preventDefault();
          const current = selectedArticle;
          document.body.classList.remove("mf-split-collapsed");
          renderToggle();
          showMessage("mf-split-placeholder", "选择一篇文章开始阅读");
          if (current) {
            const entries = [...list.querySelectorAll("article.entry-item")];
            const index = entries.indexOf(current);
            const visible = entry => entry.getClientRects().length > 0;
            const target = visible(current)
              ? current
              : entries.slice(index + 1).find(visible) ||
                entries.slice(0, index).reverse().find(visible);
            requestAnimationFrame(() => {
              target?.focus({ preventScroll: true });
              target?.scrollIntoView({ block: "nearest" });
            });
          }
        });
        wrap.appendChild(back);
        pager.insertBefore(wrap, next);
      });
      scrollTo({ top: 0 });

      if (article) {
        document.querySelectorAll("article.entry-item.mf-split-current")
          .forEach(node => {
            if (node !== article) {
              node.classList.remove("mf-split-current");
              node.setAttribute("aria-selected", "false");
            }
          });
        article.classList.add("mf-split-current");
        article.setAttribute("aria-selected", "true");
        selectedArticle = article;
        setCursor(article);
        renderMarkAbove();
      } else {
        document.querySelectorAll("article.entry-item.mf-split-current")
          .forEach(node => {
            node.classList.remove("mf-split-current");
            node.setAttribute("aria-selected", "false");
          });
        selectedArticle = null;
        renderMarkAbove();
      }
      if (article && entry.querySelector("[data-toggle-status]")?.dataset.value === "read") {
        article.classList.replace("item-status-unread", "item-status-read");
      }
      syncReaderToolbar();
    } catch (error) {
      if (timedOut) {
        showMessage("mf-split-error", "正文加载超时", "请求超过 12 秒");
      } else if (error.name !== "AbortError") {
        showMessage("mf-split-error", "正文加载失败", error.message);
        console.error("Miniflux split pane could not load entry:", error);
      }
    } finally {
      clearTimeout(timeout);
      if (request === controller) reader.removeAttribute("aria-busy");
    }
  };

  const configureTitleLinks = () => {
    for (const title of list.querySelectorAll("article.entry-item .item-title a")) {
      const article = title.closest("article.entry-item");
      if (desktop.matches) {
        if (!title.dataset.mfSplitHref) {
          title.dataset.mfSplitHref = title.href;
          title.dataset.mfSplitTarget = title.getAttribute("target") || "";
        }
        title.removeAttribute("href");
        title.removeAttribute("target");
        title.removeAttribute("role");
        title.tabIndex = -1;
        article.setAttribute("role", "option");
        article.setAttribute(
          "aria-selected",
          String(article.classList.contains("mf-split-current")),
        );
        article.tabIndex = 0;
      } else if (title.dataset.mfSplitHref) {
        title.href = title.dataset.mfSplitHref;
        if (title.dataset.mfSplitTarget) title.target = title.dataset.mfSplitTarget;
        else title.removeAttribute("target");
        title.removeAttribute("role");
        title.removeAttribute("tabindex");
        article.removeAttribute("role");
        article.removeAttribute("aria-selected");
        article.removeAttribute("tabindex");
      }
    }
  };
  const decorateListEntries = root => {
    for (const article of root.querySelectorAll("article.entry-item")) {
      if (!article.dataset.iconChecked) {
        article.dataset.iconChecked = "1";
        const title = article.querySelector(".item-title a");
        const source = article.querySelector(".item-meta-info-title a")?.textContent.trim();
        if (title && source) title.dataset.iconLetter = source[0];
      }
    }
    configureTitleLinks();
    applyListFilter();
  };
  decorateListEntries(list);
  desktop.addEventListener("change", configureTitleLinks);

  const visibleEntries = () =>
    [...list.querySelectorAll("article.entry-item")]
      .filter(article => article.getClientRects().length > 0);
  const setCursor = (article, focus = false) => {
    if (!article) return;
    cursorArticle?.classList.remove("mf-list-cursor");
    cursorArticle = article;
    cursorArticle.classList.add("mf-list-cursor");
    cursorArticle.scrollIntoView({ block: "nearest" });
    if (focus) cursorArticle.focus({ preventScroll: true });
  };

  list.addEventListener("click", event => {
    const article = event.target.closest("article.entry-item");
    if (!article || !desktop.matches) return;
    const title = article.querySelector(".item-title a");
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      window.open(title.dataset.mfSplitHref, "_blank", "noreferrer");
      return;
    }
    load(title.dataset.mfSplitHref, article);
  }, true);
  list.addEventListener("auxclick", event => {
    const article = event.target.closest("article.entry-item");
    if (!article || !desktop.matches || event.button !== 1) return;
    const title = article.querySelector(".item-title a");
    event.preventDefault();
    event.stopImmediatePropagation();
    window.open(title.dataset.mfSplitHref, "_blank", "noreferrer");
  }, true);
  list.addEventListener("keydown", event => {
    if (!desktop.matches || event.key !== "Enter") return;
    const article = event.target.closest("article.entry-item");
    if (!article) return;
    event.preventDefault();
    const title = article.querySelector(".item-title a");
    load(title.dataset.mfSplitHref, article);
  });

  const nextPageUrl = root => {
    const links = root.querySelectorAll(
      ".pagination a.pagination-next[href], .pagination a.pagination-forward[href], " +
      ".pagination .pagination-next a[href], .pagination .pagination-forward a[href]",
    );
    const href = links[links.length - 1]?.getAttribute("href");
    return href ? new URL(href, location.href).href : "";
  };
  let nextPage = nextPageUrl(document);
  let loadingNextPage = false;
  let pendingEntries = [];

  const fetchNextPage = async () => {
    if (!nextPage || loadingNextPage || !desktop.matches) return [];
    loadingNextPage = true;
    const url = nextPage;
    try {
      const response = await fetch(url, {
        credentials: "same-origin",
        headers: { "X-Requested-With": "Miniflux-Split-List" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const page = new DOMParser().parseFromString(
        htmlPolicy.createHTML(await response.text()),
        "text/html",
      );
      const sourceList = page.querySelector(".items");
      if (!sourceList) throw new Error("Entry list markup not found");
      const knownIds = new Set(
        [
          ...list.querySelectorAll("article.entry-item[data-id]"),
          ...pendingEntries,
        ].map(node => node.dataset.id),
      );
      const entries = [...sourceList.querySelectorAll("article.entry-item")]
        .filter(node => !knownIds.has(node.dataset.id))
        .map(node => document.importNode(node, true));
      if (!entries.length) throw new Error("Next page contained no new entries");
      nextPage = nextPageUrl(page);
      pendingEntries.push(...entries);
      return entries;
    } catch (error) {
      showActionStatus(`加载更多未读失败：${error.message}`, true);
      console.error("Miniflux split list could not load the next page:", error);
      return [];
    } finally {
      loadingNextPage = false;
    }
  };
  const loadNextPage = async () => {
    if (!pendingEntries.length) {
      const entries = await fetchNextPage();
      if (!entries.length) return [];
    }
    const entry = pendingEntries.shift();
    list.appendChild(entry);
    decorateListEntries(list);
    return [entry];
  };

  let refreshingUnread = false;
  let manageListViewport = false;
  const fillListViewport = async () => {
    let addedCount = 0;
    while (pendingEntries.length || nextPage) {
      const entries = await loadNextPage();
      if (!entries.length) break;
      const entry = entries[0];
      if (list.children.length > 1 && list.scrollHeight > list.clientHeight) {
        list.removeChild(entry);
        pendingEntries.unshift(entry);
        break;
      }
      addedCount += entries.length;
    }
    return addedCount;
  };
  const trimListViewport = () => {
    while (list.children.length > 1 && list.scrollHeight > list.clientHeight) {
      const entry = list.lastElementChild;
      if (entry === selectedArticle || entry === cursorArticle) break;
      list.removeChild(entry);
      if (list.scrollHeight < list.clientHeight) {
        list.appendChild(entry);
        break;
      }
      pendingEntries.unshift(entry);
    }
  };
  const fitListViewport = async () => {
    if (!manageListViewport || refreshingUnread || !desktop.matches) return;
    trimListViewport();
    await fillListViewport();
  };
  syncListViewport = fitListViewport;
  let fitListTimer;
  addEventListener("resize", () => {
    clearTimeout(fitListTimer);
    fitListTimer = setTimeout(fitListViewport, 120);
  });
  const refreshUnreadList = async () => {
    if (refreshingUnread || !desktop.matches) return null;
    refreshingUnread = true;
    const selectedId = selectedArticle?.dataset.id;
    try {
      const response = await fetch("/unread", {
        credentials: "same-origin",
        headers: { "X-Requested-With": "Miniflux-Split-List" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const page = new DOMParser().parseFromString(
        htmlPolicy.createHTML(await response.text()),
        "text/html",
      );
      const sourceList = page.querySelector(".items");
      if (!sourceList) throw new Error("Unread list markup not found");
      const entries = [...sourceList.querySelectorAll("article.entry-item")]
        .map(node => document.importNode(node, true));
      list.replaceChildren();
      pendingEntries = entries;
      nextPage = nextPageUrl(page);
      manageListViewport = true;
      const loadedCount = await fillListViewport();
      selectedArticle = selectedId
        ? list.querySelector(`article.entry-item[data-id="${selectedId}"]`)
        : null;
      if (selectedArticle) {
        selectedArticle.classList.add("mf-split-current");
        selectedArticle.setAttribute("aria-selected", "true");
      }
      cursorArticle = null;
      const cursorTarget = selectedArticle || visibleEntries()[0];
      if (cursorTarget) setCursor(cursorTarget);
      renderMarkAbove();
      return loadedCount;
    } catch (error) {
      console.error("Miniflux split list could not refresh unread entries:", error);
      throw error;
    } finally {
      refreshingUnread = false;
    }
  };
  markAbove.addEventListener("click", async () => {
    if (refreshingUnread || !desktop.matches) return;
    const targets = unreadAbove();
    markAbove.disabled = true;
    markAbove.classList.add("mf-list-refreshing");
    try {
      if (targets.length) {
        await markEntriesRead(targets.map(article => +article.dataset.id));
      }
      const loadedCount = await refreshUnreadList();
      document.body.classList.add("mf-split-unread-only");
      const markedText = targets.length ? `已将上方 ${targets.length} 条标记为已读；` : "";
      showActionStatus(
        loadedCount ? `${markedText}已加载 ${loadedCount} 条未读` : `${markedText}没有未读文章`,
      );
    } catch (error) {
      showActionStatus(`更新未读列表失败：${error.message}`, true);
      console.error("Miniflux could not update the unread list:", error);
    } finally {
      markAbove.disabled = false;
      markAbove.classList.remove("mf-list-refreshing");
      renderMarkAbove();
    }
  });

  document.addEventListener("keydown", async event => {
    if (!desktop.matches || event.defaultPrevented) return;
    if (event.target === searchInput) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeSearch();
      }
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey ||
        event.target.closest("input, textarea, select, button, a, [contenteditable]")) return;
    const key = event.key.toLowerCase();
    if (key === "/") {
      event.preventDefault();
      openSearch();
      return;
    }
    if (key === "escape" && searchPanel.classList.contains("mf-list-search-open")) {
      event.preventDefault();
      closeSearch();
      return;
    }
    if (key === "b") {
      event.preventDefault();
      toggle.click();
      return;
    }
    if (key === "m" || key === "s") {
      const selector = key === "m" ? "[data-toggle-status]" : "[data-toggle-starred]";
      if (!inner.querySelector(`.entry-header ${selector}`)) return;
      event.preventDefault();
      activateEntryAction(key);
      return;
    }
    if (!["j", "k", "n", "p", " "].includes(key)) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    if (key === " ") {
      if (!cursorArticle?.getClientRects().length) return;
      const title = cursorArticle.querySelector(".item-title a");
      await load(title.dataset.mfSplitHref, cursorArticle);
      return;
    }
    const direction = key === "j" || key === "n" ? 1 : -1;
    let entries = visibleEntries();
    const anchor = entries.includes(cursorArticle)
      ? cursorArticle
      : entries.includes(selectedArticle) ? selectedArticle : null;
    const index = anchor
      ? entries.indexOf(anchor)
      : direction > 0 ? -1 : entries.length;
    let target = entries[index + direction];
    if (!target && direction > 0 && key === "j" &&
        (pendingEntries.length || nextPage)) {
      const added = await loadNextPage();
      entries = visibleEntries();
      target = added.find(article => entries.includes(article));
    }
    if (!target) return;
    setCursor(target, true);
    if (key === "n" || key === "p") return;
    const title = target.querySelector(".item-title a");
    await load(title.dataset.mfSplitHref, target);
  }, true);

  reader.addEventListener("click", event => {
    if (!desktop.matches || event.metaKey || event.ctrlKey ||
        event.shiftKey || event.altKey) return;
    const pager = event.target.closest("#mf-split-reader .pagination a[data-page]");
    if (!pager) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const id = pager.pathname.match(/\/entry\/(\d+)/)?.[1];
    const article = id && document.querySelector(`article.entry-item[data-id="${id}"]`);
    load(pager.href, article);
  }, true);

});
