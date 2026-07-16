import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { isItemPureFx } from "~/engine/item/fx/purity/isItemPureFx";
import { readGridLocationOccupantsFx } from "~/engine/location/read/readGridLocationOccupantsFx";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { isGridRuntimeItem } from "~/engine/runtime/read/isGridRuntimeItem";
import type { GridRuntimeItemSchema } from "~/engine/runtime/schema/GridRuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace readAvailableStackItemsFx {
	export interface Props {
		itemId: IdSchema.Type;
		locations: ReadonlyArray<GridLocationSchema.Type>;
		runtime: RuntimeSchema.Type;
	}
}

/** Reads every pure compatible non-full stack inside one explicit location set. */
export const readAvailableStackItemsFx = Effect.fn("readAvailableStackItemsFx")(function* ({
	itemId,
	locations,
	runtime,
}: readAvailableStackItemsFx.Props) {
	const occupants = yield* readGridLocationOccupantsFx({
		items: runtime.items.filter(isGridRuntimeItem),
		locations,
	});
	const candidates = occupants
		.flatMap((entry) => entry.items)
		.filter((item) => item.item.id === itemId && item.quantity < item.item.maxStackSize);
	const purity = yield* Effect.forEach(candidates, (item) =>
		isItemPureFx({
			item,
			runtime,
		}).pipe(
			Effect.map((pure) => ({
				item,
				pure,
			})),
		),
	);

	return purity
		.filter(({ pure }) => pure)
		.map(({ item }) => item)
		.sort((left, right) => {
			return (
				left.location.position.y - right.location.position.y ||
				left.location.position.x - right.location.position.x ||
				left.id.localeCompare(right.id)
			);
		}) satisfies GridRuntimeItemSchema.Type[];
});
