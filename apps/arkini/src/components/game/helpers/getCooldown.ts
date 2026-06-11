import type { BoardItem, ViewItem } from "../types";

export function getCooldown(item: ViewItem, boardItem: BoardItem, nowMs: number) {
  const cooldownUntil = boardItem.state.producer?.cooldownUntil;
  const cooldownMs = item.producerCooldownMs ?? 0;
  if (!cooldownUntil || cooldownMs <= 0) {
    return { coolingDown: false, progress: 1, remainingMs: 0 };
  }

  const remainingMs = Math.max(0, Date.parse(cooldownUntil) - nowMs);
  if (remainingMs <= 0) {
    return { coolingDown: false, progress: 1, remainingMs: 0 };
  }

  return {
    coolingDown: true,
    progress: Math.max(0, Math.min(1, 1 - remainingMs / cooldownMs)),
    remainingMs,
  };
}
