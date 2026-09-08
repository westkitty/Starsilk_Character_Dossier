// components.js — small DOM helpers shared by every panel.
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'disabled') node.disabled = !!v;
    else if (k === 'checked') node.checked = !!v;
    else if (k === 'value') node.value = v;
    else if (k === 'style') node.setAttribute('style', v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const child of children.flat(9)) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export const $ = (sel, root = document) => root.querySelector(sel);

let toastHost = null;
export function toast(message, kind = 'info', ms = 4200) {
  if (!toastHost) {
    toastHost = el('div', { id: 'toast-host', 'aria-live': 'polite' });
    document.body.append(toastHost);
  }
  const t = el('div', { class: `toast toast-${kind}`, role: 'status' }, message);
  toastHost.append(t);
  setTimeout(() => { t.classList.add('fade'); setTimeout(() => t.remove(), 400); }, ms);
}

/** Modal dialog. content may be Node or builder(close) → Node. Returns close. */
export function dialog({ title, content, actions = [], width = 560, onClose = null }) {
  const dlg = document.createElement('dialog');
  dlg.className = 'modal';
  dlg.style.maxWidth = `${width}px`;
  const body = el('div', { class: 'modal-body' });
  const close = result => { dlg.close(result); dlg.remove(); onClose?.(result); };
  dlg.append(
    el('div', { class: 'modal-head' },
      el('h3', { text: title }),
      el('button', { class: 'icon-btn', 'aria-label': 'Close dialog', onClick: () => close() }, '✕')),
    body,
    el('div', { class: 'modal-foot' }, actions.map(a =>
      el('button', { class: a.class || 'btn', disabled: a.disabled, title: a.title || '', onClick: () => a.keepOpen ? a.onClick?.(close) : (a.onClick?.(close), close()) }, a.label))),
  );
  body.append(typeof content === 'function' ? content(close) : content);
  dlg.addEventListener('close', () => dlg.remove());
  dlg.addEventListener('cancel', () => onClose?.());
  document.body.append(dlg);
  dlg.showModal();
  return close;
}

/** Small field builders */
export function field(labelText, inputEl, { hint = null } = {}) {
  const lab = document.createElement('label');
  lab.className = 'field';
  const span = el('span', { class: 'field-label', text: labelText });
  lab.append(span, inputEl);
  if (!inputEl.id) inputEl.id = `fld_${Math.random().toString(36).slice(2, 9)}`;
  lab.setAttribute('for', inputEl.id);
  if (hint) lab.append(el('small', { class: 'hint', text: hint }));
  return lab;
}

export function textInput({ value = '', placeholder = '', label, hint, onChange, multiline = false, rows = 3 }) {
  const input = multiline
    ? el('textarea', { rows, placeholder, onInput: e => onChange?.(e.target.value) }, value)
    : el('input', { type: 'text', value, placeholder, onInput: e => onChange?.(e.target.value) });
  return { node: label ? field(label, input, { hint }) : input, input };
}

export function numberInput({ value = 0, min, max, step = 1, label, hint, onChange, width = null }) {
  const input = el('input', { type: 'number', value, step });
  if (min != null) input.min = min;
  if (max != null) input.max = max;
  if (width) input.style.width = width;
  input.addEventListener('input', () => onChange?.(Number(input.value)));
  return { node: label ? field(label, input, { hint }) : input, input };
}

export function selectInput({ options, value, label, onChange, hint = null }) {
  const sel = el('select', {},
    options.map(o => el('option', { value: o.value, text: o.label, selected: o.value === value })));
  sel.addEventListener('change', () => onChange?.(sel.value));
  return { node: label ? field(label, sel, { hint }) : sel, input: sel };
}

export function checkInput({ checked = false, label, onChange, hint = null }) {
  const input = el('input', { type: 'checkbox', checked, onChange: e => onChange?.(e.target.checked) });
  const lab = el('label', { class: 'check' }, input, el('span', { text: label }));
  if (hint) lab.append(el('small', { class: 'hint', text: hint }));
  return { node: lab, input };
}

export function button(label, onClick, opts = {}) {
  return el('button', {
    class: opts.class || 'btn', title: opts.title || '',
    disabled: opts.disabled, 'aria-label': opts['aria-label'] || label,
    onClick,
  }, label);
}

export function section(title, ...children) {
  const details = el('details', { class: 'panel-section', open: '' },
    el('summary', {}, title),
    el('div', { class: 'panel-section-body' }, children));
  return details;
}

export function swatch([r, g, b], { size = 18, title, onRemove = null, onEdit = null } = {}) {
  const s = el('span', {
    class: 'swatch',
    title: title || `rgb(${r},${g},${b})`,
    style: `background: rgb(${r},${g},${b}); width:${size}px; height:${size}px;`,
    tabindex: '0', role: 'img', 'aria-label': `colour rgb(${r},${g},${b})`,
  });
  if (onEdit) s.addEventListener('dblclick', onEdit);
  if (onRemove) {
    s.addEventListener('click', onRemove);
    s.style.cursor = 'pointer';
  }
  return s;
}

/** <img> that lazy-loads its thumbnail from the image store (IDB-backed). */
export function lazyThumb(imgStore, imageId, { cls = '', alt = '', title = '' } = {}) {
  const img = el('img', { class: cls, alt, title, draggable: 'false' });
  const sync = () => {
    const t = imgStore.getThumb(imageId);
    if (t) img.src = t;
    else imgStore.ensure(imageId).then(() => { const tt = imgStore.getThumb(imageId); if (tt) img.src = tt; }).catch(() => {});
  };
  if (imageId) sync();
  return img;
}

export function statusPill(status) {
  const map = { queued: 'QUEUED', generating: 'GENERATING', processing: 'PROCESSING', complete: 'DONE', failed: 'FAILED', cancelled: 'CANCELLED' };
  return el('span', { class: `pill pill-${status}`, text: map[status] ?? status });
}
