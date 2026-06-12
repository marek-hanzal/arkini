import type { RectLike } from "./types";

export function cellKey(x: number, y: number) {
  return `${x}:${y}`;
}

export function queryRect(selector: string) {
  return document.querySelector<HTMLElement>(selector)?.getBoundingClientRect() ?? null;
}

export function tileVisualRect(rect: RectLike, insetRatio = 0.1): RectLike {
  const inset = Math.min(rect.width, rect.height) * insetRatio;

  return {
    left: rect.left + inset,
    top: rect.top + inset,
    width: Math.max(1, rect.width - inset * 2),
    height: Math.max(1, rect.height - inset * 2),
  };
}

export function inventorySinkRect(source: RectLike, anchor: RectLike | null = queryRect("[data-inventory-summary]")): RectLike {
  const size = Math.max(22, Math.min(42, Math.min(source.width, source.height) * 0.55));
  const left = anchor ? anchor.left + anchor.width / 2 - size / 2 : window.innerWidth / 2 - size / 2;
  const top = anchor ? anchor.top + anchor.height / 2 - size / 2 : window.innerHeight - 72 - size / 2;

  return { left, top, width: size, height: size };
}

export function cssEscape(value: string) {
  return value.replaceAll('"', '\\"');
}

export function without<T>(set: ReadonlySet<T>, value: T) {
  const next = new Set(set);
  next.delete(value);
  return next;
}

export function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function formatMs(ms: number) {
  if (ms <= 0) return "▶";
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.ceil(seconds / 60)}m`;
}
