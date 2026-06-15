import type { DraggablePayload } from "~/drag/DraggablePayload";
import type { ResolvedDraggableAnimation } from "~/drag/ResolvedDraggableAnimation";
import type { RectLike } from "~/play/types";
import { rectForNode } from "./rectForNode";

/**
 * Reject/failure return animation is intentionally kept in the generic drag layer.
 * It is not a game command result, so there is no command visual event to plan from.
 */
export namespace animateReturn {
	export interface Props<ItemId extends string, Source, Overlay, Kind extends string> {
		source: DraggablePayload<ItemId, Source, Overlay>;
		dragRect: RectLike | null;
		hideSources(ids: readonly string[]): void;
		clearActiveDrag(): void;
		clearHiddenSources(): void;
		animate(animation: ResolvedDraggableAnimation<ItemId, Kind, Overlay>): Promise<void> | void;
	}
}

export const animateReturn = async <
	ItemId extends string = string,
	Source = unknown,
	Overlay = unknown,
	Kind extends string = string,
>({
	source,
	dragRect,
	hideSources,
	clearActiveDrag,
	clearHiddenSources,
	animate,
}: animateReturn.Props<ItemId, Source, Overlay, Kind>) => {
	const from = dragRect;
	const to = rectForNode({
		nodeId: source.sourceNodeId,
	});

	if (!from || !to) {
		clearActiveDrag();
		return;
	}

	if (source.hideWhenActive !== false)
		hideSources([
			source.sourceId,
		]);
	clearActiveDrag();
	await animate({
		itemId: source.itemId,
		actorKey: source.actorKey,
		from,
		to,
		overlay: source.overlay,
	});
	clearHiddenSources();
};
