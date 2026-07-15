import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

export namespace discardRuntimeItemOwnedStateFx {
	export interface Props {
		ownerItemId: IdSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/**
 * Permanently discards every runtime entity owned beneath one item identity.
 *
 * The root item survives. Buffered descendants, their nested ownership trees,
 * active jobs, job-owned materials and queued work are removed without release
 * output because destructive consume intentionally converts the whole identity.
 */
export const discardRuntimeItemOwnedStateFx = Effect.fn("discardRuntimeItemOwnedStateFx")(
	function* ({ ownerItemId, runtime }: discardRuntimeItemOwnedStateFx.Props) {
		const ownerItemIds = new Set<IdSchema.Type>([
			ownerItemId,
		]);
		const discardedItemIds = new Set<IdSchema.Type>();
		const discardedJobIds = new Set<IdSchema.Type>();

		let changed = true;
		while (changed) {
			changed = false;

			for (const job of runtime.jobs) {
				if (!ownerItemIds.has(job.ownerItemId) || discardedJobIds.has(job.id)) continue;
				discardedJobIds.add(job.id);
				changed = true;
			}

			for (const item of runtime.items) {
				if (item.id === ownerItemId || discardedItemIds.has(item.id)) continue;

				const ownedByItem =
					item.location.scope === "input" && ownerItemIds.has(item.location.ownerItemId);
				const ownedByJob =
					item.location.scope === "job" && discardedJobIds.has(item.location.jobId);
				if (!ownedByItem && !ownedByJob) continue;

				discardedItemIds.add(item.id);
				ownerItemIds.add(item.id);
				changed = true;
			}
		}

		return {
			...runtime,
			items: runtime.items.filter((item) => !discardedItemIds.has(item.id)),
			jobs: runtime.jobs.filter((job) => !discardedJobIds.has(job.id)),
			jobQueue: (runtime.jobQueue ?? []).filter(
				(request) => !ownerItemIds.has(request.ownerItemId),
			),
		} satisfies RuntimeSchema.Type;
	},
);
