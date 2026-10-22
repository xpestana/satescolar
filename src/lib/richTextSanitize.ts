/**
 * Allow-list sanitizer for HTML written in `RichTextEditor` that ends up inside a generated
 * document. The PDF preview writes that HTML into a same-origin iframe, so a script or an event
 * handler typed by one user would run in the browser of whoever opens the document.
 *
 * Keeps the formatting the editor offers (bold, italic, lists, headings, alignment, tables) and
 * drops everything else: unknown elements are unwrapped (their text stays), dangerous ones are
 * removed with their content, and the only attribute kept is `style` reduced to `text-align`.
 */

const ALLOWED_TAGS = new Set([
  "b", "strong", "i", "em", "u", "s", "strike", "sub", "sup",
  "p", "br", "div", "span", "blockquote", "hr",
  "ul", "ol", "li",
  "h1", "h2", "h3", "h4",
  "table", "thead", "tbody", "tr", "td", "th",
]);

const REMOVED_WITH_CONTENT = new Set([
  "script", "style", "iframe", "object", "embed", "svg", "math", "link", "meta",
  "noscript", "template", "form", "input", "button", "select", "textarea", "img", "video", "audio",
]);

const TEXT_ALIGN = /text-align\s*:\s*(left|right|center|justify)/i;

function cleanNode(node: Node, doc: Document): Node[] {
  if (node.nodeType === Node.TEXT_NODE) return [doc.createTextNode(node.textContent ?? "")];
  if (node.nodeType !== Node.ELEMENT_NODE) return [];

  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  if (REMOVED_WITH_CONTENT.has(tag)) return [];

  const children = Array.from(el.childNodes).flatMap((child) => cleanNode(child, doc));
  if (!ALLOWED_TAGS.has(tag)) return children;

  const clean = doc.createElement(tag);
  const align = el.getAttribute("style")?.match(TEXT_ALIGN)?.[1];
  if (align) clean.setAttribute("style", `text-align:${align.toLowerCase()}`);
  children.forEach((child) => clean.appendChild(child));
  return [clean];
}

export function sanitizeRichText(html: string | null | undefined): string {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const out = doc.createElement("div");
  Array.from(doc.body.childNodes)
    .flatMap((child) => cleanNode(child, doc))
    .forEach((child) => out.appendChild(child));
  return out.innerHTML;
}

/** True when the HTML has no visible text (an editor left with `<br>` or `&nbsp;` counts as empty). */
export function isRichTextEmpty(html: string | null | undefined): boolean {
  if (!html) return true;
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .trim();
  return text === "";
}
