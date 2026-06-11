import type { BoardViewItem } from "~/domains/database";

export type DragData =
  | { kind: "board"; boardItemId: string; itemId: string }
  | { kind: "inventory"; slotIndex: number; itemId: string; quantity: number };

export type DropData =
  | { kind: "cell"; x: number; y: number; boardItemId: string | null }
  | { kind: "inventory-slot"; slotIndex: number }
  | { kind: "inventory-bin" };

export interface CommittedDrag {
  source: DragData;
  hideSource: boolean;
}

export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type FlyerKind = "move" | "stash";

export interface FlyerModel {
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
export const flyMs = 320;
export const flashMs = 650;
