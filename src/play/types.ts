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
	/** Optional item rendered above the flyer so merge flyers can cross-fade into their result. */
	crossFadeItemId?: string;
}

export type DragData = DraggablePayload<string, DragSource, VisualMeta>;
export type DropData = DroppablePayload<DropTarget>;

export interface RectLike {
	left: number;
	top: number;
	width: number;
	height: number;
}

export type FlyerKind =
	| "move"
	| "stash"
	| "place"
	| "deplete"
	| "merge-source"
	| "merge-target"
	| "imprint-source";

export interface FlyerModel extends VisualMeta {
	id: string;
	itemId: string;
	from: RectLike;
	to: RectLike;
	kind: FlyerKind;
}

export const flashMs = 650;
export const flyerRenderSettleMs = 180;
