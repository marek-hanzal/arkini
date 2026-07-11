import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { LocationSchema } from "~/v1/location/schema/LocationSchema";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

export namespace readAvailableStackItemsFx {
	export interface Props {
		itemId: IdSchema.Type;
		runtime: RuntimeSchema.Type;
		scope: LocationSchema.Type["scope"];
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
		}) satisfies RuntimeItemSchema.Type[];
});
