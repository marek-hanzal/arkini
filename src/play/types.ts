import type { BoardViewItem } from "~/play/logic/playTypes";
import type { DraggablePayload, DroppablePayload } from "~/drag/hook/useDraggableControl";

export type GameDragSource =
	| {
			kind: "board";
			boardItemId: string;
	  }
	| {
			kind: "inventory";
			slotIndex: number;
			quantity: number;
	  };

export type GameDropTarget =
	| {
			kind: "cell";
			x: number;
			y: number;
			boardItemId?: string;
	  }
	| {
			kind: "inventory-slot";
			slotIndex: number;
	  };

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

export type FlyerKind =
	| "move"
	| "stash"
	| "place"
	| "deplete"
	| "merge-source"
	| "merge-target"
	| "imprint-source";

export interface FlyerModel extends GameVisualMeta {
	id: string;
	itemId: string;
	from: RectLike;
	to: RectLike;
	kind: FlyerKind;
}

export type ProducerView = NonNullable<BoardViewItem["producer"]>;

export const flashMs = 650;
export const flyerRenderSettleMs = 180;
