# miniflux-haru

A focused reading interface for Miniflux 2.3/2.4, delivered as a custom
stylesheet and a dependency-free JavaScript enhancement.

Paste the two files into **Settings → Integration → Custom CSS / Custom
JavaScript**. No Miniflux fork or build step is required.

## Design

### Desktop

At `1024px` and wider, unread and search-result pages become a two-pane reader:

- a `400px` article queue with independent scrolling;
- an `800px` reading pane with a `736px` maximum content measure;
- two-line article titles with source, age, and reading-time metadata;
- restrained unread and selected states instead of a full-height accent bar;
- client-side search across all loaded titles and sources;
- All, Unread, and Starred filters with live counts;
- automatic loading of subsequent result pages;
- a collapsible queue for distraction-free reading.

The article title stays in the document flow. Its source, author, date, reading
time, and native Miniflux actions form one metadata area beneath it. The fixed
reader toolbar is reserved for navigation and mode controls.

### Mobile

Below `1024px`, Haru keeps Miniflux's native list-to-entry navigation. This
avoids a nested pane competing with browser back gestures and preserves the
small-screen behavior of Miniflux and its PWA.

### Reading typography

- `19px / 1.85` desktop reading scale and `18px / 1.82` mobile scale;
- a `736px` maximum line measure in the desktop reader;
- system UI sans-serif for controls and headings;
- CJK serif stack for long-form body copy;
- normalized headings, quotations, code, media, tables, and captions;
- no forced first-line indentation or full justification;
- light and dark warm-neutral palettes with accessible focus states;
- reduced-motion support.

## Interaction

| Action | Mouse/touch | Keyboard |
|---|---|---|
| Open next/previous visible article | Toolbar or article queue | `J` / `K` |
| Search loaded articles | Search field | `/` |
| Toggle read state | Native article action | `M` |
| Toggle starred state | Native article action | `S` |
| Collapse/restore article queue | Panel button | `B` |
| Show keyboard reference | `?` button | `?` |
| Open an article in a new tab | Modified or middle click | Browser default |

Read and starred state changes use Miniflux's native controls. The custom
script mirrors the resulting state into the article queue, so filters and
counts remain synchronized.

The existing "mark entries above as read" action remains available in the
queue toolbar. After it succeeds, the queue switches to unread-only mode.

## Installation

1. Open Miniflux → **Settings → Integration**.
2. Paste [`custom.css`](custom.css) into **Custom Stylesheet**.
3. Paste [`custom.js`](custom.js) into **Custom JavaScript**.
4. Save and hard-refresh once.

CSS can be used independently. JavaScript adds the split reader, search and
filters, keyboard controls, progressive page loading, theme detection, source
initials, content cleanup, and native action synchronization.

### Database-side installation

For a self-hosted Miniflux backed by PostgreSQL:

```bash
docker cp custom.js  <miniflux_db>:/tmp/custom.js
docker cp custom.css <miniflux_db>:/tmp/custom.css
docker exec <miniflux_db> psql -U <user> -d <db> -c \
  "UPDATE users SET \
     custom_js  = pg_read_file('/tmp/custom.js'), \
     stylesheet = pg_read_file('/tmp/custom.css') \
   WHERE username='<admin>'"
```

## Optional server-side normalization

[`extras/rss_engine_normalize.py`](extras/rss_engine_normalize.py) provides a
`selectolax`-based `normalize_html()` helper for feed preprocessors. It removes
presentational markup, empty wrappers, tracking query parameters, and common
emoji markup before content reaches Miniflux.

## Files

```text
custom.css                       Visual system and responsive layout
custom.js                        Progressive interaction enhancements
extras/rss_engine_normalize.py   Optional feed HTML normalization
```

## Compatibility

- Miniflux 2.3.x and 2.4.x markup
- current Chromium, Firefox, and Safari
- iPhone PWA and desktop browsers
- JavaScript environments with or without the Trusted Types API

When Miniflux changes template class names, native pages remain usable; only
the matching progressive enhancement is skipped.

## License

MIT.
