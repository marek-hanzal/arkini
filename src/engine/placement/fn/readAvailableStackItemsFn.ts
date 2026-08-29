import { Array, Order } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { isItemPureFn } from "~/engine/item/fn/isItemPureFn";
import { readGridLocationOccupantsFn } from "~/engine/location/fn/readGridLocationOccupantsFn";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { isGridRuntimeItemFn } from "~/engine/runtime/read/fn/isGridRuntimeItemFn";
import type { GridRuntimeItemSchema } from "~/engine/runtime/schema/GridRuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace readAvailableStackItemsFn {
	export interface Props {
		itemId: IdSchema.Type;
		locations: ReadonlyArray<GridLocationSchema.Type>;
		runtime: RuntimeSchema.Type;
	}
}

/** Reads every pure compatible non-full stack inside one explicit location set. */
export const readAvailableStackItemsFn = ({
	itemId,
	locations,
	runtime,
}: readAvailableStackItemsFn.Props) => {
	const gridItems = Array.getSomes(runtime.items.map(isGridRuntimeItemFn));
	const occupants = readGridLocationOccupantsFn({
		items: gridItems,
		locations,
	});
	const candidates = occupants
		.flatMap((entry) => entry.items)
		.filter((item) => item.item.id === itemId && item.quantity < item.item.maxStackSize);
	return candidates
		.filter((item) =>
			isItemPureFn({
				item,
				runtime,
			}),
		)
		.sort((left, right) => {
			return (
				left.location.position.y - right.location.position.y ||
				left.location.position.x - right.location.position.x ||
				Order.String(left.id, right.id)
			);
		}) satisfies GridRuntimeItemSchema.Type[];
};
