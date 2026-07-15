import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import { isItemPureFx } from "~/v1/item/fx/purity/isItemPureFx";
import { readGridLocationOccupantsFx } from "~/v1/location/read/readGridLocationOccupantsFx";
import type { GridLocationSchema } from "~/v1/location/schema/GridLocationSchema";
import { isGridRuntimeItem } from "~/v1/runtime/read/isGridRuntimeItem";
import type { GridRuntimeItemSchema } from "~/v1/runtime/schema/GridRuntimeItemSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

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
