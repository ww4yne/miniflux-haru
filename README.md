# miniflux-haru

A personal Miniflux 2.3/2.4 custom theme + reading-mode polish, paired with a Claude/Haru-style warm palette.

Two files. Paste them into **Settings → Integration → Custom CSS / Custom JavaScript**. That's it.

- `custom.css` — palette, layout, compact list, reading mode (article body normalization)
- `custom.js`  — seven small modules (no framework, no deps)

Tested on Miniflux 2.3.1 and 2.4.x, iPhone PWA + desktop browsers.

## Screenshots

Place your own here. Suggested shots:
- Unread list (desktop and iPhone)
- Article detail (desktop and iPhone)
- Dark mode side by side

## What it does

### Visual

- 13-variable palette (4 background tiers, 3 text tiers, accent + hover/dim/border) auto-tracking light/dark
- Tracks Miniflux's actual theme (not just OS preference) via a runtime background-color probe
- Compact header: logo left, SVG-only icon menu right, single row on every viewport
- Compact entry list: first-letter source chip replacing favicons, single-line ellipsis titles, 3-px accent unread bar on the left
- On-demand search and All / Unread / Starred filters remain available through
  `/`; the list toolbar button refreshes the first page of unread entries
- Native `mark page as read` button relocated into the bottom pagination row (saves a footer row)
- `back to list` shortcut injected into entry-detail pagination
- Desktop split pane at 1024px and wider: compact 360px entry list beside the
  existing 768px reading layout, centered as one unit with independent scrolling
- A 40px reader toolbar provides sidebar collapse, previous / next entry,
  read, starred, and original-article actions while retaining Miniflux's
  native action state
- The bottom reader pagination retains a centered `back to list` link that
  appears only while the sidebar is collapsed, then expands the sidebar,
  clears the reader, and focuses the selected entry
- The desktop list renders every entry already returned by Miniflux in its own
  scroll region; a fixed, square-edged bottom action explicitly fetches the
  next unread page and disappears completely after the final page
- Read entries are muted instead of removed, while the active highlight follows
  the selected entry
- Article content uses the browser document scrollbar instead of a nested
  reader scrollbar
- `J` / `K` move to and open the next / previous visible entry; `J`
  automatically fetches the next unread page when it reaches a loaded boundary
- `N` / `P` move the independent list cursor without loading an article, and
  `Space` opens the cursor entry
- `M` toggles read state, `S` toggles starred state, `B` collapses the list,
  and `/` opens search
- The split reader keeps the article title in the document flow, centered at a
  compact 21px rather than duplicating it in the toolbar

### Reading mode (article body)

- 16px / 1.72 split-reader scale, with the existing larger mobile scale retained
- 2-em first-line indent on top-level paragraphs (CJK convention), suppressed inside lists/blockquotes/cells
- `text-align: justify` with `inter-ideograph` for Chinese reading
- Headings normalized to four sizes (20 / 18 / 16 / 15) regardless of source markup
- Block quotes get a 3-px accent left border on bg2
- `<pre>` and inline `<code>` use bg3 with overflow-x; syntax-highlight colors are preserved via `color: revert` exception
- Images full-width with rounded corners; inline (no width attr) images capped at 1.4 em as a safety net for source emoji
- Tables centered on bg3 grid, scrollable on narrow screens
- Empty `<p>` and consecutive `<br>` collapsed

### Emoji removal

Configurable preference: if you do not want any emoji in your feeds, this strips them:

- All `<img>` whose class matches `emoji | smiley | twemoji | emojione | wp-smiley | custom-emoji`
- All unicode emoji code points (`\u{1F300}-\u{1FAFF}`, `\u{2600}-\u{27BF}`, etc., plus ZWJ and VS-16), via text-node walker; `<pre>/<code>` content is left untouched

To keep emoji: delete the unicode-emoji walker block in module 6 of `custom.js` (about 8 lines), and remove the matching block from the optional `rss_engine_normalize.py` snippet below.

### Quality of life

- Hidden: subscribe-shortcut "+" in nav, logout button, dropdown chevron in logo, share/external-link/fetch-content actions on article detail, redundant URL fragments, pagination first/last buttons
- Mobile (≤ 720 px): unread badge hidden, header logo compressed, all icons single-row scroll-free
- Compact spacing throughout (main padding zero, pagination margins 6/8 px, article-content paragraph spacing 0.7 em)

## Installation

1. Open Miniflux → **Settings → Integration**
2. Paste `custom.css` into **Custom Stylesheet**
3. Paste `custom.js` into **Custom JavaScript**
4. Save. Hard-refresh once.

Both files are independent. CSS works on its own. JS adds the relocations,
source chips, theme probe, explicit mark-above action, reading-mode DOM cleanup,
and desktop split-pane loading.

### Database-side install (optional)

If you administer the Miniflux Postgres directly and want to push updates from a workstation without using the web UI, this is the cleanest path (no shell or SQL escaping issues):

```bash
docker cp custom.js  <miniflux_db>:/tmp/custom.js
docker cp custom.css <miniflux_db>:/tmp/custom.css
docker exec <miniflux_db> psql -U <user> -d <db> -c \
  "UPDATE users SET \
     custom_js  = pg_read_file('/tmp/custom.js'), \
     stylesheet = pg_read_file('/tmp/custom.css') \
   WHERE username='<admin>'"
```

## Optional: server-side HTML normalization

If you also run an RSS preprocessor (custom scraper, full-text fetcher, etc.), you can move heavy DOM cleanup off the browser. A reusable `normalize_html()` snippet using `selectolax` is at [`extras/rss_engine_normalize.py`](extras/rss_engine_normalize.py). It does the same things the JS fallback does, plus:

- `<div>` wrapper flattening
- `<font>` strip, `<u>` to `<em>`
- `align=` attribute removal
- `utm_*` / `fbclid` / `gclid` / `mc_cid` / `mc_eid` / `ref` query-string stripping on `<a href>`
- Multiple consecutive `<br>` to paragraph break

Wire it where your pipeline produces the final article HTML, before writing to whatever feed/DB downstream Miniflux consumes.

## File map

```
custom.css                       paste into Custom Stylesheet
custom.js                        paste into Custom JavaScript
extras/rss_engine_normalize.py   optional server-side HTML cleaner
```

## Palette

| role              | light     | dark      |
|-------------------|-----------|-----------|
| `--bg`            | `#F3F0E8` | `#2A2520` |
| `--bg2`           | `#FFFFFF` | `#352F29` |
| `--bg3`           | `#EAE7DF` | `#3D362F` |
| `--bg4`           | `#DDD9D0` | `#4A433B` |
| `--text`          | `#1A1915` | `#ECE8E1` |
| `--text2`         | `#6B6560` | `#A39E96` |
| `--text3`         | `#9C958C` | `#706B63` |
| `--accent`        | `#B0584A` | `#C46B5B` |
| `--accent-h`      | `#9C4D40` | `#D87C6D` |
| `--accent-dim`    | 10% alpha | 12% alpha |
| `--accent-bd`     | 30% alpha | 30% alpha |

Light/dark resolution priority:

1. `html.mf-dark` set by the JS theme probe (highest specificity)
2. `@media (prefers-color-scheme: dark)` fallback when JS hasn't run yet
3. `:root` default (light)

## JS modules

| # | Module | Purpose |
|---|--------|---------|
| 1 | `first-letter icon` | sets `data-icon-letter` on each entry title; CSS renders the chip |
| 2 | `theme probe` | reads `.header` computed background, toggles `mf-dark`/`mf-light` on `<html>` |
| 3 | `mark-page relocate` | moves the native `[data-action="markPageAsRead"]` button into the bottom `.pagination` row |
| 4 | `back-to-list button` | injects a centered link on entry-detail pagination; intercepts `pushState` for adjacent-entry navigation |
| 5 | `batch mark-read API` | posts an explicit set of entry IDs to `entry/status read`; used by the desktop toolbar action |
| 6 | `entry-content cleanup` | inline-style strip, empty `<p>` removal, unicode emoji walker (skips `<pre>/<code>`) |
| 7 | `desktop split pane` | at ≥1024px, adds unread refresh, fixed next-page loading, an independent keyboard cursor, on-demand search and filters, split navigation, and the explicit mark-above-read action |

## License

MIT. Take what you want.
