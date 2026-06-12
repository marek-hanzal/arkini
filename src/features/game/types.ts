import type { BoardViewItem } from "~/domains/database";
import type { DraggablePayload, DroppablePayload } from "./useDraggableControl";

export type GameDragSource =
  | { kind: "board"; boardItemId: string }
  | { kind: "inventory"; slotIndex: number; quantity: number };

export type GameDropTarget =
  | { kind: "cell"; x: number; y: number; boardItemId: string | null }
  | { kind: "inventory-slot"; slotIndex: number }
  | { kind: "inventory-bin" };

export interface GameVisualMeta {
  quantity?: number;
  producer?: BoardViewItem["producer"];
}

export type GameDragData = DraggablePayload<string, GameDragSource, GameVisualMeta>;
export type GameDropData = DroppablePayload<GameDropTarget>;

export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type FlyerKind = "move" | "stash" | "place";

export interface FlyerModel extends GameVisualMeta {
  id: string;
  itemId: string;
  from: RectLike;
  to: RectLike;
  kind: FlyerKind;
}

export type BuildCell = { x: number; y: number };
export type ProducerView = NonNullable<BoardViewItem["producer"]>;

export const columns = 7;
export const rows = 9;
export const flashMs = 650;

export function boardSourceId(boardItemId: string) {
  return `board:${boardItemId}`;
}

export function boardCellNodeId(x: number, y: number) {
  return `board-cell:${x}:${y}`;
}

export function inventorySourceId(slotIndex: number) {
  return `inventory:${slotIndex}`;
}

export function inventorySlotNodeId(slotIndex: number) {
  return `inventory-slot:${slotIndex}`;
}

export const boardContainerNodeId = "board-container";
export const inventoryContainerNodeId = "inventory-container";
export const inventoryBinNodeId = "inventory-bin";
