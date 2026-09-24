import { Effect } from "effect";
import { GameConfigFx } from "~/game-config/context/GameConfigFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import { reconcileOutboundDeliveriesRuntimeFx } from "~/production-delivery/fx/reconcileOutboundDeliveriesRuntimeFx";

export namespace destroyInventoriesFx {
	export interface Props {
		readonly removedItems: readonly RuntimeItemSchema.Type[];
		readonly runtime: RuntimeSchema.Type;
		readonly ownershipRuntime?: RuntimeSchema.Type;
	}
	export interface Result {
		readonly runtime: RuntimeSchema.Type;
		readonly removed: readonly RuntimeItemSchema.Type[];
	}
}

/** Permanently destroys rooms owned by removed identities, including nested rooms and work.
 * This is destruction, never an expiry/return operation. Snapshot ancestry covers jobs
 * already detached by completion while their material roots are still being consumed. */
export const destroyInventoriesFx = Effect.fn("destroyInventoriesFx")(function* ({
	removedItems,
	runtime,
	ownershipRuntime,
}: destroyInventoriesFx.Props) {
	const spaces = new Set(
		removedItems.flatMap((item) =>
			item.inventory === undefined
				? []
				: [
						item.inventory,
					],
		),
	);
	if (spaces.size === 0)
		return {
			runtime,
			removed: [],
		} satisfies destroyInventoriesFx.Result;
	const config = yield* GameConfigFx;
	const snapshot = ownershipRuntime ?? runtime;
	const liveIds = new Set(runtime.items.map(({ id }) => id));
	const liveJobIds = new Set(runtime.jobs.map(({ id }) => id));
	const items = [
		...runtime.items,
		...snapshot.items.filter(({ id }) => !liveIds.has(id)),
		...removedItems,
	];
	const jobs = [
		...runtime.jobs,
		...snapshot.jobs.filter(({ id }) => !liveJobIds.has(id)),
	];
	const discardedIds = new Set<string>();
	const discardedJobs = new Set<string>();
	let changed = true;
	while (changed) {
		changed = false;
		for (const item of items) {
			const location = item.location;
			const destroyed =
				location.scope === "board"
					? spaces.has(location.space)
					: location.scope === "delivery"
						? spaces.has(location.origin.space)
						: location.scope === "input"
							? discardedIds.has(location.ownerItemId)
							: discardedJobs.has(location.jobId);
			if (!destroyed || discardedIds.has(item.id)) continue;
			discardedIds.add(item.id);
			if (item.inventory !== undefined) spaces.add(item.inventory);
			changed = true;
		}
		for (const job of jobs)
			if (discardedIds.has(job.ownerItemId) && !discardedJobs.has(job.id)) {
				discardedJobs.add(job.id);
				changed = true;
			}
	}
	const removed = runtime.items.filter(({ id }) => discardedIds.has(id));
	const previousSpace =
		runtime.previousSpace !== undefined && !spaces.has(runtime.previousSpace)
			? runtime.previousSpace
			: undefined;
	const draft: RuntimeSchema.Type = {
		...runtime,
		currentSpace: spaces.has(runtime.currentSpace)
			? (previousSpace ?? config.start.currentSpace)
			: runtime.currentSpace,
		previousSpace,
		items: runtime.items.filter(({ id }) => !discardedIds.has(id)),
		jobs: runtime.jobs.filter(({ id }) => !discardedJobs.has(id)),
		jobQueue: runtime.jobQueue.filter(({ ownerItemId }) => !discardedIds.has(ownerItemId)),
		defaultLineByOwnerItemId: Object.fromEntries(
			Object.entries(runtime.defaultLineByOwnerItemId).filter(
				([id]) => !discardedIds.has(id),
			),
		),
		templateUidBySpace: Object.fromEntries(
			Object.entries(runtime.templateUidBySpace).filter(
				([space]) => !spaces.has(Number(space)),
			),
		),
	};
	return {
		runtime: yield* reconcileOutboundDeliveriesRuntimeFx({
			runtime: draft,
		}),
		removed,
	} satisfies destroyInventoriesFx.Result;
});
