import { boardCellNodeId } from "~/board/boardIdentity";
import { inventorySlotNodeId } from "~/inventory/inventoryIdentity";
import type { MagneticDropContext } from "~/drag/hook/useDraggableControl";
import type { GameDragSource, GameDropData, GameDropTarget, GameVisualMeta, RectLike } from "~/play/types";

const magneticDropThresholdPx = 28;

export function resolveMagneticGameDropTarget({
  source,
  dragRect,
}: MagneticDropContext<string, GameDragSource, GameVisualMeta>): GameDropData | null {
  const center = rectCenter(dragRect);

  if (source.source.kind === "board") {
    const cell = nearestMagneticElement("[data-board-cell]", center);
    if (!cell) return null;

    const [x, y] = (cell.element.getAttribute("data-board-cell") ?? "").split(":").map(Number);
    if (!Number.isInteger(x) || !Number.isInteger(y)) return null;

    const nodeId = cell.element.getAttribute("data-drag-node-id") ?? boardCellNodeId(x, y);
    return {
      targetId: nodeId,
      targetNodeId: nodeId,
      target: {
        kind: "cell",
        x,
        y,
        boardItemId: cell.element.getAttribute("data-board-item-id") || null,
      },
    } satisfies GameDropData;
  }

  const slot = nearestMagneticElement("[data-inventory-slot]", center);
  if (!slot) return null;

  const slotIndex = Number(slot.element.getAttribute("data-inventory-slot"));
  if (!Number.isInteger(slotIndex)) return null;

  const nodeId = slot.element.getAttribute("data-drag-node-id") ?? inventorySlotNodeId(slotIndex);
  return {
    targetId: nodeId,
    targetNodeId: nodeId,
    target: { kind: "inventory-slot", slotIndex } satisfies GameDropTarget,
  } satisfies GameDropData;
}

interface Point {
  x: number;
  y: number;
}

interface MagneticElement {
  element: HTMLElement;
  distance: number;
  centerDistance: number;
}

function nearestMagneticElement(selector: string, point: Point): MagneticElement | null {
  const candidates = [...document.querySelectorAll<HTMLElement>(selector)]
    .map((element) => toMagneticElement(element, point))
    .filter((candidate): candidate is MagneticElement => Boolean(candidate))
    .sort((left, right) => left.distance - right.distance || left.centerDistance - right.centerDistance);

  return candidates[0] ?? null;
}

function toMagneticElement(element: HTMLElement, point: Point): MagneticElement | null {
  const rect = element.getBoundingClientRect();
  const distance = distanceFromRect(point, rect);
  if (distance > magneticDropThresholdPx) return null;

  return {
    element,
    distance,
    centerDistance: distanceBetween(point, rectCenter(rect)),
  };
}

function distanceFromRect(point: Point, rect: RectLike) {
  const dx = Math.max(rect.left - point.x, 0, point.x - (rect.left + rect.width));
  const dy = Math.max(rect.top - point.y, 0, point.y - (rect.top + rect.height));
  return Math.hypot(dx, dy);
}

function rectCenter(rect: RectLike): Point {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function distanceBetween(left: Point, right: Point) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}
