import { RuntimeFx } from "~/game-runtime/context/RuntimeFx";
import { Effect } from "effect";

import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { discardRuntimeItemTreeFx } from "~/game-runtime/fx/discardRuntimeItemTreeFx";
import { removeRuntimeItemIdentityFx } from "~/game-runtime/fx/removeRuntimeItemIdentityFx";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import { placeRuntimeItemBestEffortFx } from "~/item-placement/fx/placeRuntimeItemBestEffortFx";
import { abortJobRuntimeFx } from "~/production-job/fx/abortJobRuntimeFx";

export namespace forceRemoveRuntimeItemFx {
	export interface Props {
		readonly item: RuntimeItemSchema.Type;
		readonly origin: GridLocationSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}

	export interface Result {
		readonly runtime: RuntimeSchema.Type;
		readonly events: readonly GameEventSchema.Type[];
	}
}

/** Builds one unpublished removal draft: cancel work, free the owner cell, return reserves, then buffers.
 * Capacity losses are committed facts; every other rejection aborts the whole caller's transition. */
export const forceRemoveRuntimeItemFx = Effect.fn("forceRemoveRuntimeItemFx")(function* ({
	item,
	origin,
	runtime,
}: forceRemoveRuntimeItemFx.Props) {
	const jobs = runtime.jobs.filter((job) => job.ownerItemId === item.id);
	const jobIds = new Set(jobs.map((job) => job.id));
	const consumed = runtime.items.filter(
		(candidate) => candidate.location.scope === "job" && jobIds.has(candidate.location.jobId),
	);
	const reservations = runtime.items.filter(
		(candidate) =>
			candidate.location.scope === "reserved" && jobIds.has(candidate.location.jobId),
	);
	const buffers = runtime.items.filter(
		(candidate) =>
			candidate.location.scope === "input" && candidate.location.ownerItemId === item.id,
	);
	const events: GameEventSchema.Type[] = jobs.map((job) => ({
		type: "job:aborted",
		jobId: job.id,
		ownerItemId: item.id,
		canonicalItemId: item.item.id,
		lineId: job.lineId,
		reason: "owner-removed",
	}));
	let draft: RuntimeSchema.Type = {
		...runtime,
		jobs: runtime.jobs.filter((job) => !jobIds.has(job.id)),
		jobQueue: runtime.jobQueue.filter((request) => request.ownerItemId !== item.id),
	};
	for (const consumedItem of consumed) {
		const discarded = yield* discardRuntimeItemTreeFx({
			item: consumedItem,
			ownerItemId: item.id,
			source: "consumed-input",
			reason: "job-aborted",
			runtime: draft,
		});
		draft = discarded.runtime;
		events.push(...discarded.events);
	}
	const removed = yield* removeRuntimeItemIdentityFx({
		item,
		runtime: draft,
	});
	draft = removed.runtime;
	events.push(...removed.events);
	for (const reservation of reservations) {
		const placed = yield* placeRuntimeItemBestEffortFx({
			itemId: reservation.id,
			origin,
			originItemId: item.id,
			source: "reservation",
			runtime: draft,
		});
		draft = placed.runtime;
		events.push(...placed.events);
	}
	if (item.location.scope === "job" || item.location.scope === "reserved") {
		const reconciled = yield* abortJobRuntimeFx({
			reason: "material-expired",
			jobId: item.location.jobId,
			runtime: draft,
			overflow: "discard",
		}).pipe(
			Effect.provideService(RuntimeFx, {
				read: Effect.succeed(runtime),
			}),
		);
		draft = reconciled.runtime;
		events.push(...reconciled.events);
	}
	for (const buffer of buffers) {
		const placed = yield* placeRuntimeItemBestEffortFx({
			itemId: buffer.id,
			origin,
			originItemId: item.id,
			source: "buffer",
			runtime: draft,
		});
		draft = placed.runtime;
		events.push(...placed.events);
	}
	return {
		runtime: draft,
		events,
	} satisfies forceRemoveRuntimeItemFx.Result;
});
