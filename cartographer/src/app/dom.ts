/** Tiny DOM helpers — no framework, no globals. */

export type Child = Node | string | null | undefined | false;

export type ElProps = {
  class?: string;
  style?: string;
  text?: string;
  dataset?: Record<string, string>;
  [key: string]: unknown;
};

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: ElProps = {},
  children: Child[] | Child = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = String(value);
    else if (key === 'style' && typeof value === 'string') node.setAttribute('style', value);
    else if (key === 'text') node.textContent = String(value);
    else if (key === 'dataset') Object.assign(node.dataset, value as Record<string, string>);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (key in node && key !== 'list' && key !== 'form') {
      try {
        (node as unknown as Record<string, unknown>)[key] = value;
      } catch {
        node.setAttribute(key, String(value));
      }
    } else {
      node.setAttribute(key, String(value));
    }
  }
  append(node, children);
  return node;
}

export function append(parent: Node, children: Child[] | Child): void {
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child === null || child === undefined || child === false) continue;
    parent.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
}

export function clear(node: Node): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function button(
  label: string,
  options: {
    title?: string;
    onClick?: (event: MouseEvent) => void;
    class?: string;
    ariaLabel?: string;
    pressed?: boolean;
    disabled?: boolean;
    type?: 'button' | 'submit';
  } = {},
): HTMLButtonElement {
  return el('button', {
    type: options.type ?? 'button',
    class: options.class ?? 'sktc-btn',
    text: label,
    title: options.title ?? label,
    ariaLabel: options.ariaLabel ?? label,
    ariaPressed: options.pressed === undefined ? undefined : String(options.pressed),
    disabled: options.disabled ?? false,
    onClick: options.onClick,
  }) as HTMLButtonElement;
}

export function iconButton(
  glyph: string,
  label: string,
  onClick?: (event: MouseEvent) => void,
  options: { pressed?: boolean; class?: string; disabled?: boolean } = {},
): HTMLButtonElement {
  return button(glyph, {
    title: label,
    ariaLabel: label,
    onClick,
    pressed: options.pressed,
    disabled: options.disabled,
    class: `sktc-btn sktc-btn--icon ${options.class ?? ''}`.trim(),
  });
}

export function fieldLabel(forId: string, text: string): HTMLLabelElement {
  return el('label', { htmlFor: forId, text, class: 'sktc-field-label' });
}

export function field(
  id: string,
  labelText: string,
  control: HTMLElement,
  hint?: string,
): HTMLElement {
  const wrap = el('div', { class: 'sktc-field' }, [fieldLabel(id, labelText), control]);
  if (hint) append(wrap, el('p', { class: 'sktc-hint', text: hint, id: `${id}-hint` }));
  return wrap;
}

let fieldCounter = 0;
export function nextFieldId(prefix: string): string {
  fieldCounter += 1;
  return `sktc-${prefix}-${fieldCounter.toString(36)}`;
}

export function badge(text: string, tone: 'thread' | 'warn' | 'danger' | 'ok' | 'plain' = 'plain'): HTMLElement {
  const className = tone === 'plain' ? 'sktc-badge' : `sktc-badge sktc-badge--${tone}`;
  return el('span', { class: className, text });
}
