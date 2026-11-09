import { initials } from '../format/format';

/**
 * Простые рендереры ячеек AG Grid на чистом DOM (без innerHTML — данные экранируются).
 */

/** Аватар с инициалами + имя (+ необязательная подпись под именем). */
export function avatarCell(
  name: string,
  opts: { bg?: string; fg?: string; sub?: string; size?: number } = {},
): HTMLElement {
  const wrap = document.createElement('span');
  wrap.style.cssText = 'display:flex;align-items:center;gap:10px;min-width:0';

  const av = document.createElement('span');
  const size = opts.size ?? 30;
  av.setAttribute('aria-hidden', 'true');
  av.textContent = initials(name);
  av.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;background:${opts.bg ?? '#F2F4F7'};color:${opts.fg ?? '#344054'}`;

  const text = document.createElement('span');
  text.style.cssText = 'display:flex;flex-direction:column;min-width:0;line-height:1.3';
  const n = document.createElement('span');
  n.textContent = name;
  n.style.cssText = 'font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
  text.append(n);
  if (opts.sub) {
    const s = document.createElement('span');
    s.textContent = opts.sub;
    s.style.cssText = 'font-size:12px;color:#475467';
    text.append(s);
  }

  wrap.append(av, text);
  return wrap;
}

/** Цветной бейдж-«таблетка». */
export function pillCell(label: string, bg: string, fg: string, dot?: string): HTMLElement {
  const el = document.createElement('span');
  el.style.cssText = `display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;line-height:1.5;white-space:nowrap;background:${bg};color:${fg}`;
  if (dot) {
    const d = document.createElement('span');
    d.style.cssText = `width:7px;height:7px;border-radius:50%;background:${dot}`;
    el.append(d);
  }
  el.append(document.createTextNode(label));
  return el;
}

/** Текст со статусной точкой (без подложки). */
export function dotCell(label: string, fg: string, dot: string): HTMLElement {
  const el = document.createElement('span');
  el.style.cssText = `display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:500;color:${fg}`;
  const d = document.createElement('span');
  d.style.cssText = `width:7px;height:7px;border-radius:50%;background:${dot}`;
  el.append(d, document.createTextNode(label));
  return el;
}
