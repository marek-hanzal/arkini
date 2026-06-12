import type { RectLike } from "~/play/types";

export function queryElement(selector: string) {
  return document.querySelector<HTMLElement>(selector) ?? null;
}

export function queryRect(selector: string): RectLike | null {
  return queryElement(selector)?.getBoundingClientRect() ?? null;
}

export function cssEscape(value: string) {
  return typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape(value) : value.replaceAll('"', '\\"');
}
