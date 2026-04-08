/**
 * Escape a string for safe insertion into HTML text or attribute values.
 * Use this whenever user-supplied data is rendered via innerHTML.
 */
export function escHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

type AttrValue = string | boolean | null | undefined;
type Child = Node | string | null | undefined;

/**
 * Create a typed DOM element with attributes and children.
 * Prefer this over innerHTML when event listeners will be attached,
 * or when attribute values contain user-supplied data.
 *
 * - Boolean `true`  → sets attribute with empty string value
 * - Boolean `false` / `null` / `undefined` → attribute is omitted
 * - String          → sets attribute value directly (no HTML injection risk)
 * - String children → appended as text nodes (no HTML injection risk)
 */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Record<string, AttrValue>,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      node.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const child of children) {
    if (child == null) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

/**
 * Schedule a callback to run after the browser has painted the next frame.
 */
export function afterNextPaint(callback: () => void): void {
  requestAnimationFrame(callback);
}

/** Remove all child nodes from an element. */
export function clearChildren(element: Element): void {
  while (element.firstChild) element.removeChild(element.firstChild);
}
