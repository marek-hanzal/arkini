import { Effect } from "effect";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import { readRuntimeItemByIdFx } from "~/game-runtime/fx/readRuntimeItemByIdFx";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { ItemNotOnBoardError } from "~/item-location/error/ItemNotOnBoardError";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";

export namespace readItemScheduleContextFx {
	export interface Result {
		readonly jobId?: IdSchema.Type;
		readonly origin: BoardLocationSchema.Type;
	}
}

/** Follows current material ownership to its visible origin; only the expiring root's job is reconciled. */
export const readItemScheduleContextFx = Effect.fn("readItemScheduleContextFx")(function* ({
	item,
	runtime,
}: {
	readonly item: RuntimeItemSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}) {
	const jobId =
		item.location.scope === "job" || item.location.scope === "reserved"
			? item.location.jobId
			: undefined;
	let current = item;
	const seen = new Set<string>();
	while (!seen.has(current.id)) {
		seen.add(current.id);
		const location = current.location;
		switch (location.scope) {
			case "board":
				return {
					jobId,
					origin: location,
				} satisfies readItemScheduleContextFx.Result;
			case "delivery":
				if (location.origin.scope === "board")
					return {
						jobId,
						origin: location.origin,
					} satisfies readItemScheduleContextFx.Result;
				return yield* Effect.fail(
					new ItemNotOnBoardError({
						itemId: item.id,
						location: location.origin,
					}),
				);
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
						new Error(`Scheduled item ${current.id} job ${location.jobId} is missing.`),
					);
				current = yield* readRuntimeItemByIdFx({
					itemId: job.ownerItemId,
					runtime,
				});
				break;
			}
			case "inventory":
			case "toolbar":
				return yield* Effect.fail(
					new ItemNotOnBoardError({
						itemId: item.id,
						location,
					}),
				);
		}
	}
	return yield* Effect.die(new Error(`Scheduled item ${item.id} has cyclic ownership.`));
});
