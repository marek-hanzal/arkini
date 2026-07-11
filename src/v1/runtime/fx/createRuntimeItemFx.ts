import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import type { ItemSchema } from "~/v1/item/schema/ItemSchema";
import type { LocationSchema } from "~/v1/location/schema/LocationSchema";
import { createRevisionFx } from "~/v1/revision/fx/createRevisionFx";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";

export namespace createRuntimeItemFx {
	export interface Props<Location extends LocationSchema.Type> {
		id: IdSchema.Type;
		item: ItemSchema.Type;
		location: Location;
		quantity: PositiveIntegerSchema.Type;
	}

	export type Result<Location extends LocationSchema.Type> = Omit<
		RuntimeItemSchema.Type,
		"location"
	> & {
		location: Location;
	};
}

/**
 * Creates one fully hydrated runtime item with its initial revision.
 */
export const createRuntimeItemFx = <Location extends LocationSchema.Type>({
	id,
	item,
	location,
	quantity,
}: createRuntimeItemFx.Props<Location>) => {
	return createRevisionFx().pipe(
		Effect.map((revision) => {
			return {
				id,
				item,
				location,
				quantity,
				revision,
			} satisfies createRuntimeItemFx.Result<Location>;
		}),
		Effect.withSpan("createRuntimeItemFx"),
	);
};
