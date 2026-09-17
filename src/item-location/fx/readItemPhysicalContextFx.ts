import { Effect } from "effect";

import { readRuntimeItemByIdFx } from "~/game-runtime/fx/readRuntimeItemByIdFx";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";

export namespace readItemPhysicalContextFx {
	export interface Result {
		readonly origin: GridLocationSchema.Type;
	}
}

/** Follows semantic ownership until it reaches the grid location that physically contains an item. */
export const readItemPhysicalContextFx = Effect.fn("readItemPhysicalContextFx")(function* ({
	item,
	runtime,
}: {
	readonly item: RuntimeItemSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}) {
	let current = item;
	const seen = new Set<IdSchema.Type>();
	while (!seen.has(current.id)) {
		seen.add(current.id);
		const location = current.location;
		switch (location.scope) {
			case "board":
			case "inventory":
			case "toolbar":
				return {
					origin: location,
				} satisfies readItemPhysicalContextFx.Result;
			case "delivery":
				return {
					origin: location.origin,
				} satisfies readItemPhysicalContextFx.Result;
			case "input":
				current = yield* readRuntimeItemByIdFx({
					itemId: location.ownerItemId,
					runtime,
				});
				break;
			case "job":
			case "reserved": {
				const job = runtime.jobs.find((candidate) => candidate.id === location.jobId);
				if (job === undefined)
					return yield* Effect.die(
						new Error(`Item ${current.id} job ${location.jobId} is missing.`),
					);
				current = yield* readRuntimeItemByIdFx({
					itemId: job.ownerItemId,
					runtime,
				});
				break;
			}
		}
	}
	return yield* Effect.die(new Error(`Item ${item.id} has cyclic ownership.`));
});
