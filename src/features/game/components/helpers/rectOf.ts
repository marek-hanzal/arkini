import type { RectSnapshot } from "../types";

export function rectOf(rect: DOMRect): RectSnapshot {
  return { height: rect.height, left: rect.left, top: rect.top, width: rect.width };
}
