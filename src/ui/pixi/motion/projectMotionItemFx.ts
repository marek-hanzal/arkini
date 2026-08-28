import { Effect } from "effect";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { QuantityPresentation } from "~/ui/pixi/motion/QuantityPresentation";

/**
 * Applies the one narrow piece of canonical truth that motion may delay.
 *
 * Deposits use their badge for remaining charges and queue owners preserve canonical work count;
 * every other badge mirrors the presented stack quantity. Keeping both fields here prevents the
 * reconciler and animation code from disagreeing.
 */
export const projectMotionItemFx = Effect.fnUntraced(function* (
	item: TileActorItem,
	presentation: QuantityPresentation | undefined,
): Generator<never, TileActorItem, never> {
	if (presentation === undefined) return item;
	const quantity =
		presentation.kind === "exact"
			? presentation.quantity
			: Math.max(1, item.quantity - presentation.quantity);
	return {
		...item,
		badgeCount:
			item.itemType === "deposit" || item.badgeKind === "queue"
				? item.badgeCount
				: quantity > 1
					? quantity
					: undefined,
		quantity,
	};
});
