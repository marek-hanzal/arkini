import { Effect } from "effect";
import { readItemScheduleFn } from "~/item-schedule/fn/readItemScheduleFn";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { LocationSchema } from "~/item-location/schema/LocationSchema";
import { createRevisionFx } from "~/item-revision/fx/createRevisionFx";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import { TypeSchema } from "~/item-definition/schema/TypeSchema";

interface CreateRuntimeItemProps<Location extends LocationSchema.Type> {
	id: IdSchema.Type;
	item: ItemSchema.Type;
	location: Location;
	quantity: PositiveIntegerSchema.Type;
	remainingUnits?: number;
	remainingDurationMs?: number;
}

type CreateRuntimeItemResult<Location extends LocationSchema.Type> = Omit<
	RuntimeItemSchema.Type,
	"location"
> & {
	location: Location;
};

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
	remainingUnits,
	remainingDurationMs,
}: CreateRuntimeItemProps<Location>) {
	const revision = yield* createRevisionFx();
	const schedule = readItemScheduleFn(item);
	return {
		id,
		item,
		location,
		quantity,
		schedule:
			schedule === undefined
				? undefined
				: {
						running: true,
						remainingIntervalMs: schedule.intervalMs,
						remainingDurationMs: schedule.durationMs,
					},
		remainingUnits,
		remainingDurationMs:
			remainingDurationMs ??
			(item.type === TypeSchema.enum.Temporary ? item.durationMs : undefined),
		revision,
	} satisfies CreateRuntimeItemResult<Location>;
});
