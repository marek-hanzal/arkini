import type { RectLike } from "~/play/types";

export interface DraggableAnimation<
	ItemId extends string = string,
	Kind extends string = string,
	Overlay = unknown,
> {
	itemId: ItemId;
	kind?: Kind;
	fromNodeId?: string;
	toNodeId?: string;
	from?: RectLike;
	to?: RectLike;
	/** Resolve the animation start from the final drag overlay rect instead of the original source node. */
	fromDrag?: boolean;
	/** App-owned visual metadata forwarded to the animation renderer. */
	overlay?: Overlay;
}
