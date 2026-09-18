import { makeJobSettlementRandomFx } from "./makeJobSettlementRandomFx";
import { discardRuntimeItemTreeFx } from "~/game-runtime/fx/discardRuntimeItemTreeFx";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import { Effect, Option } from "effect";

import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import type { JobRuntimeItemSchema } from "~/game-runtime/schema/JobRuntimeItemSchema";
import type { ReservedRuntimeItemSchema } from "~/game-runtime/schema/ReservedRuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { narrowGridRuntimeItemFn } from "~/game-runtime/fn/narrowGridRuntimeItemFn";
import { readRuntimeItemByIdFx } from "~/game-runtime/fx/readRuntimeItemByIdFx";

import { settleJobRuntimeFx } from "./settleJobRuntimeFx";

export namespace abortJobRuntimeFx {
	export interface Props {
		readonly jobId: IdSchema.Type;
		readonly reason: "material-expired" | "player-cancelled";
		readonly overflow?: "discard";
		readonly runtime: RuntimeSchema.Type;
	}

	export interface Result {
		readonly events: readonly GameEventSchema.Type[];
		readonly runtime: RuntimeSchema.Type;
	}
}

/** Aborts exact work, consuming its material and returning reservations through ordinary settlement. */
export const abortJobRuntimeFx = Effect.fn("abortJobRuntimeFx")(function* ({
	jobId,
	reason,
	runtime,
	overflow,
}: abortJobRuntimeFx.Props) {
	const job = runtime.jobs.find((candidate) => candidate.id === jobId);
	if (job === undefined) return yield* Effect.die(new Error(`Job ${jobId} is missing.`));
	const runtimeOwner = yield* readRuntimeItemByIdFx({
		itemId: job.ownerItemId,
		runtime,
	});
	const owner = Option.getOrUndefined(narrowGridRuntimeItemFn(runtimeOwner));
	if (owner === undefined)
		return yield* Effect.die(new Error(`Job ${jobId} owner has no grid origin.`));

	const consumedItems = runtime.items.filter(
		(item): item is JobRuntimeItemSchema.Type =>
			item.location.scope === LocationScopeEnumSchema.enum.Job &&
			item.location.jobId === job.id,
	);
	const reservations = runtime.items.filter(
		(item): item is ReservedRuntimeItemSchema.Type =>
			item.location.scope === LocationScopeEnumSchema.enum.Reserved &&
			item.location.jobId === job.id,
	);
	let draft = {
		...runtime,
		jobs: runtime.jobs.filter((candidate) => candidate.id !== job.id),
	} satisfies RuntimeSchema.Type;
	const events: GameEventSchema.Type[] = [
		{
			type: GameEventEnumSchema.enum.JobAborted,
			jobId: job.id,
			ownerItemId: owner.id,
			lineId: job.lineId,
			reason,
		},
	];
	for (const consumedItem of consumedItems) {
		const discarded = yield* discardRuntimeItemTreeFx({
			item: consumedItem,
			ownerItemId: owner.id,
			source: "consumed-input",
			reason: "job-aborted",
			runtime: draft,
		});
		draft = discarded.runtime;
		events.push(...discarded.events);
	}
	const released = yield* makeJobSettlementRandomFx({
		job,
		program: settleJobRuntimeFx({
			job,
			owner,
			reservations,
			overflow,
			runtime: draft,
		}),
	});
	return {
		events: [
			...events,
			...released.events,
		],
		runtime: released.runtime,
	} satisfies abortJobRuntimeFx.Result;
});
