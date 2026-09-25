import { Effect } from "effect";
import { match, P } from "ts-pattern";

import { readRuntimeItemByIdFx } from "~/game-runtime/fx/readRuntimeItemByIdFx";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";

export namespace readItemPhysicalContextFx {
	export interface Result {
		readonly origin: BoardLocationSchema.Type;
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
		const origin = yield* match(location)
			.with(
				{
					scope: "board",
				},
				(location) => Effect.succeed(location),
			)
			.with(
				{
					scope: "terminal",
				},
				(location) => Effect.succeed(location.origin),
			)
			.with(
				{
					scope: "delivery",
				},
				(location) => Effect.succeed(location.origin),
			)
			.with(
				{
					scope: "input",
				},
				(location) =>
					Effect.gen(function* () {
						current = yield* readRuntimeItemByIdFx({
							itemId: location.ownerItemId,
							runtime,
						});
						return undefined;
					}),
			)
			.with(
				{
					scope: P.union("job", "reserved"),
				},
				(location) =>
					Effect.gen(function* () {
						const job = runtime.jobs.find(
							(candidate) => candidate.id === location.jobId,
						);
						if (job === undefined)
							return yield* Effect.die(
								new Error(`Item ${current.id} job ${location.jobId} is missing.`),
							);
						current = yield* readRuntimeItemByIdFx({
							itemId: job.ownerItemId,
							runtime,
						});
						return undefined;
					}),
			)
			.exhaustive();
		if (origin !== undefined)
			return {
				origin,
			} satisfies readItemPhysicalContextFx.Result;
	}
	return yield* Effect.die(new Error(`Item ${item.id} has cyclic ownership.`));
});
