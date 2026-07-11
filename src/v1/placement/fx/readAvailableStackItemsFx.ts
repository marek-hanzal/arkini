import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { GridLocationSchema } from "~/v1/location/schema/GridLocationSchema";
import { isGridRuntimeItem } from "~/v1/runtime/read/isGridRuntimeItem";
import type { GridRuntimeItemSchema } from "~/v1/runtime/schema/GridRuntimeItemSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

export namespace readAvailableStackItemsFx {
	export interface Props {
		itemId: IdSchema.Type;
		runtime: RuntimeSchema.Type;
		scope: GridLocationSchema.Type["scope"];
	}
}

/**
 * Reads every compatible non-full stack in row-major location order.
 */
export const readAvailableStackItemsFx = Effect.fn("readAvailableStackItemsFx")(function* ({
	itemId,
	runtime,
	scope,
}: readAvailableStackItemsFx.Props) {
	return runtime.items
		.filter(isGridRuntimeItem)
		.filter((item) => {
			return (
				item.item.id === itemId &&
				item.location.scope === scope &&
				item.quantity < item.item.maxStackSize
			);
		})
		.sort((left, right) => {
			return (
				left.location.position.y - right.location.position.y ||
				left.location.position.x - right.location.position.x ||
				left.id.localeCompare(right.id)
			);
		}) satisfies GridRuntimeItemSchema.Type[];
});
