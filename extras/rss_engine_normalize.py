"""
HTML reading-mode normalizer for RSS preprocessing pipelines.

Drop-in helper that takes the raw article HTML coming out of a scraper /
full-text fetcher / RSS handler, and returns a cleaned HTML fragment ready
to be served to Miniflux (or any reader downstream).

Pairs with the `miniflux-haru` custom CSS / JS but is independent: the CSS
will look fine without this normalizer, and this normalizer makes sense even
if you're using a different reader theme.

Rules (all best-effort; failures fall back to the original HTML):

  1.  Strip color / background / font / margin / padding / line-height /
      text-align / text-indent declarations from every element's inline
      `style`. Drop the attribute entirely if nothing meaningful remains.
  2.  Unwrap `<div>` nodes that have no attributes (or all-empty attributes),
      flattening pointless wrappers. Done inner-to-outer.
  3.  Strip `<font>` tags, keeping their children.
  4.  Drop `<p>` elements whose textContent is empty AND that contain no
      <img>/<video>/<iframe>.
  5.  Drop `<p>` elements that only contain `<br>` and whitespace.
  6.  Collapse 2-or-more consecutive `<br>` into a paragraph break.
  7.  Strip `align="..."` attributes.
  8.  Replace `<u>` with `<em>` (many sources misuse <u> as emphasis; the
      browser underline reads as a link).
  9.  Strip emoji `<img>` tags (class matches emoji|smiley|twemoji|emojione|
      wp-smiley|custom-emoji).
  10. Strip unicode emoji characters from text (covers Emoji & Pictographs,
      ZWJ, and variation selectors).
  11. Collapse runs of whitespace in non-<pre> trees.
  12. Strip tracking query parameters from <a href>: utm_*, ref, ref_src,
      fbclid, gclid, mc_cid, mc_eid.

Dependencies: `selectolax` (`pip install selectolax`).
Python 3.10+ recommended.
"""

import re
from selectolax.parser import HTMLParser

_STYLE_KILL_PROPS = re.compile(
    r"(?:^|;)\s*(?:color|background[\w-]*|font[\w-]*|"
    r"margin[\w-]*|padding[\w-]*|line-height|text-align|text-indent)\s*:[^;]*",
    flags=re.I,
)
_EMOJI_IMG_CLASSES = re.compile(
    r"\b(emoji|smiley|twemoji|emojione|wp-smiley|custom-emoji)\b", re.I,
)
_EMOJI_CHAR = re.compile(
    "["
    "\U0001F300-\U0001FAFF"
    "\U00002600-\U000027BF"
    "\U0001F000-\U0001F2FF"
    "\u2300-\u23FF"
    "\u2B00-\u2BFF"
    "\u2700-\u27BF"
    "\uFE0F\u200D"
    "]+",
    flags=re.UNICODE,
)
_BR_RUN = re.compile(r"(?:\s*<br\s*/?>\s*){2,}", re.I)
_TRACK_QS = re.compile(
    r"(?:^|[?&])(?:utm_[^=&]+|ref|ref_src|fbclid|gclid|mc_cid|mc_eid)=[^&]*",
    re.I,
)
_MULTI_WS = re.compile(r"[ \t\u3000]{2,}")


def _strip_inline_style(node) -> None:
    style = node.attributes.get("style")
    if not style:
        return
    cleaned = _STYLE_KILL_PROPS.sub("", style).strip(" ;")
    if cleaned:
        node.attrs["style"] = cleaned
    else:
        del node.attrs["style"]


def _is_emoji_img(node) -> bool:
    cls = node.attributes.get("class") or ""
    return bool(_EMOJI_IMG_CLASSES.search(cls))


def _strip_tracking(href: str) -> str:
    if "?" not in href:
        return href
    base, qs = href.split("?", 1)
    parts = [p for p in qs.split("&") if p and not _TRACK_QS.match("?" + p)]
    return base + ("?" + "&".join(parts) if parts else "")


def normalize_html(html: str) -> str:
    """Apply all reading-mode rules. Returns original HTML on any failure."""
    if not html or "<" not in html:
        return _EMOJI_CHAR.sub("", html or "")
    try:
        tree = HTMLParser(html)
        body = tree.body or tree.root
        if body is None:
            return html

        # rule 9: kill image-style emoji
        for img in body.css("img"):
            if _is_emoji_img(img):
                img.decompose()

        # rules 1, 7, 12
        for node in body.css("*"):
            if node.attributes.get("style"):
                _strip_inline_style(node)
            if "align" in (node.attributes or {}):
                del node.attrs["align"]
            if node.tag == "a":
                href = node.attributes.get("href")
                if href:
                    new_href = _strip_tracking(href)
                    if new_href != href:
                        node.attrs["href"] = new_href

        # rule 3: strip <font>
        for f in body.css("font"):
            f.unwrap()

        # rule 8: <u> -> <em>
        for u in body.css("u"):
            try:
                inner = u.html.split(">", 1)[1].rsplit("<", 1)[0]
                new = HTMLParser(f"<em>{inner}</em>").css_first("em")
                if new is not None:
                    u.replace_with(new)
            except Exception:
                pass

        # rules 4 + 5: drop empty <p> and <p><br></p>
        for p in body.css("p"):
            if p.css_first("img"):
                continue
            if (p.text() or "").strip():
                continue
            only_br = all(
                (c.tag == "br" or (c.tag == "-text" and not (c.text() or "").strip()))
                for c in (p.iter(include_text=True) if hasattr(p, "iter") else [])
            )
            if only_br:
                p.decompose()

        # rule 2: unwrap empty-attribute <div> (inner-to-outer)
        for d in reversed(body.css("div")):
            attrs = d.attributes or {}
            if not attrs or all(not v for v in attrs.values()):
                try:
                    d.unwrap()
                except Exception:
                    pass

        out = body.html or html
        if out.startswith("<body>") and out.endswith("</body>"):
            out = out[len("<body>"):-len("</body>")]

        # rule 6: collapse consecutive <br>
        out = _BR_RUN.sub("</p><p>", out)
        # rule 10: strip unicode emoji from final HTML
        out = _EMOJI_CHAR.sub("", out)
        # rule 11: whitespace coalesce (skip if <pre> present)
        if "<pre" not in out.lower():
            out = _MULTI_WS.sub(" ", out)
        return out
    except Exception:
        return html


if __name__ == "__main__":
    cases = [
        ("<p>hello smile and party</p>", "plain"),
        ("<p>x<br><br><br>y</p>", "consecutive br collapse"),
        ("<p>x</p><p></p><p>  </p><p><br></p><p>y</p>", "empty <p> removal"),
        ('<p style="color:red;font-size:30px;margin:5px">red text</p>',
         "inline style strip"),
        ("<div><div><p>nested</p></div></div>", "div unwrap"),
        ('<font color="red">hi</font>', "<font> strip"),
        ("<u>strong</u>", "<u> to <em>"),
        ('<img class="emoji" src="x.png" alt=":)">', "emoji <img> kill"),
        ('<p align="center">aligned</p>', "align attr strip"),
        ('<a href="https://x.com/?utm_source=rss&keep=this">link</a>',
         "tracking strip"),
    ]
    for src, label in cases:
        print(f"-- {label}")
        print(f"   in:  {src!r}")
        print(f"   out: {normalize_html(src)!r}")
