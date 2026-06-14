import type { RectLike } from "~/play/types";

export interface ResolvedDraggableAnimation<
	ItemId extends string = string,
	Kind extends string = string,
	Overlay = unknown,
> {
	itemId: ItemId;
	kind?: Kind;
	from: RectLike;
	to: RectLike;
	overlay?: Overlay;
}
