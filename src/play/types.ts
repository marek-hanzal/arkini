import type { DraggablePayload } from "~/drag/DraggablePayload";
import type { DroppablePayload } from "~/drag/DroppablePayload";
import type { BoardViewItem } from "~/play/logic/playTypes";

export type DragSource =
	| {
			kind: "board";
			boardItemId: string;
	  }
	| {
			kind: "inventory";
			slotIndex: number;
			stackId: string;
			quantity: number;
	  };

export type DropTarget =
	| {
			kind: "cell";
			x: number;
			y: number;
			boardItemId?: string;
	  }
	| {
			kind: "inventory-slot";
			slotIndex: number;
	  }
	| {
			kind: "inventory";
	  };

export interface VisualMeta {
	quantity?: number;
	activation?: BoardViewItem["activation"];
}

export type DragData = DraggablePayload<string, DragSource, VisualMeta>;
export type DropData = DroppablePayload<DropTarget>;

export interface RectLike {
	left: number;
	top: number;
	width: number;
	height: number;
}

export type VisualTransitionKind = "move" | "stash" | "place" | "consume";

export const flashMs = 650;
