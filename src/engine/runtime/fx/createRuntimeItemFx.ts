import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { LocationSchema } from "~/engine/location/schema/LocationSchema";
import { createRevisionFx } from "~/engine/revision/fx/createRevisionFx";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import { TypeSchema } from "~/engine/item/schema/TypeSchema";

export namespace createRuntimeItemFx {
	export interface Props<Location extends LocationSchema.Type> {
		id: IdSchema.Type;
		item: ItemSchema.Type;
		location: Location;
		quantity: PositiveIntegerSchema.Type;
		remainingCharges?: number;
		remainingDurationMs?: number;
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
export const createRuntimeItemFx = Effect.fn("createRuntimeItemFx")(function* <
	Location extends LocationSchema.Type,
>({
	id,
	item,
	location,
	quantity,
	remainingCharges,
	remainingDurationMs,
}: createRuntimeItemFx.Props<Location>) {
	const revision = yield* createRevisionFx();
	return {
		id,
		item,
		location,
		quantity,
		remainingCharges,
		remainingDurationMs:
			remainingDurationMs ??
			(item.type === TypeSchema.enum.Temporary ? item.durationMs : undefined),
		revision,
	} satisfies createRuntimeItemFx.Result<Location>;
});
