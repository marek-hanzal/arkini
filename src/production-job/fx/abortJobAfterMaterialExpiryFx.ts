import { placeRuntimeItemBestEffortFx } from "~/item-placement/fx/placeRuntimeItemBestEffortFx";
import { discardRuntimeItemTreeFx } from "~/game-runtime/fx/discardRuntimeItemTreeFx";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import { Effect } from "effect";

import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import type { JobRuntimeItemSchema } from "~/game-runtime/schema/JobRuntimeItemSchema";
import type { ReservedRuntimeItemSchema } from "~/game-runtime/schema/ReservedRuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { readItemPhysicalContextFx } from "~/item-location/fx/readItemPhysicalContextFx";
import { readRuntimeItemByIdFx } from "~/game-runtime/fx/readRuntimeItemByIdFx";

import { releaseJobReservationsFx } from "./releaseJobReservationsFx";

export namespace abortJobAfterMaterialExpiryFx {
	export interface Props {
		readonly jobId: IdSchema.Type;
		readonly overflow?: "discard";
		readonly runtime: RuntimeSchema.Type;
	}

	export interface Result {
		readonly events: readonly GameEventSchema.Type[];
		readonly runtime: RuntimeSchema.Type;
	}
}

/** Aborts work whose committed material expired, consuming work and returning reservations. */
export const abortJobAfterMaterialExpiryFx = Effect.fn("abortJobAfterMaterialExpiryFx")(function* ({
	jobId,
	runtime,
	overflow,
}: abortJobAfterMaterialExpiryFx.Props) {
	const job = runtime.jobs.find((candidate) => candidate.id === jobId);
	if (job === undefined) return yield* Effect.die(new Error(`Job ${jobId} is missing.`));
	const owner = yield* readRuntimeItemByIdFx({
		itemId: job.ownerItemId,
		runtime,
	});
	const ownerContext = yield* readItemPhysicalContextFx({
		item: owner,
		runtime,
	});

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
			reason: "material-expired",
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
	if (overflow === "discard") {
		for (const reservation of reservations) {
			const placement = yield* placeRuntimeItemBestEffortFx({
				itemId: reservation.id,
				origin: ownerContext.origin,
				originItemId: owner.id,
				source: "reservation",
				runtime: draft,
			});
			draft = placement.runtime;
			events.push(...placement.events);
		}
		return {
			events,
			runtime: draft,
		} satisfies abortJobAfterMaterialExpiryFx.Result;
	}
	const released = yield* releaseJobReservationsFx({
		origin: ownerContext.origin,
		originItemId: owner.id,
		reservations,
		runtime: draft,
	});
	return {
		events: [
			...events,
			...released.events,
		],
		runtime: released.runtime,
	} satisfies abortJobAfterMaterialExpiryFx.Result;
});
