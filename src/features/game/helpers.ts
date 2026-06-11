import type { GameView } from "~/domains/database";
import type { RectLike } from "./types";

export function firstFreeCell(game: GameView) {
  for (let y = 0; y < game.save.boardHeight; y += 1) {
    for (let x = 0; x < game.save.boardWidth; x += 1) {
      if (!game.boardItemByCellKey[cellKey(x, y)]) return { x, y };
    }
  }
  return null;
}

export function cellKey(x: number, y: number) {
  return `${x}:${y}`;
}

export function queryRect(selector: string) {
  return document.querySelector<HTMLElement>(selector)?.getBoundingClientRect() ?? null;
}

export function syntheticBottomRect(): RectLike {
  return {
    left: window.innerWidth / 2 - 28,
    top: window.innerHeight - 92,
    width: 56,
    height: 56,
  };
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
