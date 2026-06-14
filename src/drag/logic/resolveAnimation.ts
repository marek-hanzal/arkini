import type { DraggableAnimation } from "~/drag/DraggableAnimation";
import type { ResolvedDraggableAnimation } from "~/drag/ResolvedDraggableAnimation";
import type { RectLike } from "~/play/types";
import { rectForNode } from "./rectForNode";

export namespace resolveAnimation {
	export interface Props<ItemId extends string, Kind extends string, Overlay> {
		animation: DraggableAnimation<ItemId, Kind, Overlay>;
		dragRect: RectLike | null;
	}
}

export const resolveAnimation = <
	ItemId extends string = string,
	Kind extends string = string,
	Overlay = unknown,
>({
	animation,
	dragRect,
}: resolveAnimation.Props<ItemId, Kind, Overlay>): ResolvedDraggableAnimation<
	ItemId,
	Kind,
	Overlay
> | null => {
	const from =
		animation.from ??
		(animation.fromDrag && dragRect
			? dragRect
			: rectForNode({
					nodeId: animation.fromNodeId,
				}));
	const to =
		animation.to ??
		(animation.toDrag && dragRect
			? dragRect
			: rectForNode({
					nodeId: animation.toNodeId,
				}));
	if (!from || !to) return null;
	return {
		itemId: animation.itemId,
		kind: animation.kind,
		from,
		to,
		overlay: animation.overlay,
	};
};
