import { stringifyPlannerCanonicalValue } from "~/editor/planner/stringifyPlannerCanonicalValue";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

/**
 * Identity-preserving key for exact runtime revisits.
 *
 * Unlike the later canonical planner fingerprint, this key deliberately keeps every runtime ID,
 * owner/job/input relationship and concrete coordinate. It only omits item revisions because
 * those are concurrency tokens, not planner-visible gameplay state.
 */
export const readPlannerExactRuntimeKey = (runtime: RuntimeSchema.Type) =>
	stringifyPlannerCanonicalValue({
		cheats: runtime.cheats,
		currentSpace: runtime.currentSpace,
		defaultLineByOwnerItemId: runtime.defaultLineByOwnerItemId ?? {},
		items: runtime.items
			.map((item) => ({
				id: item.id,
				itemId: item.item.id,
				location: item.location,
				quantity: item.quantity,
				remainingCharges: item.remainingCharges,
				remainingDurationMs: item.remainingDurationMs,
			}))
			.sort((left, right) => left.id.localeCompare(right.id)),
		jobQueue: [
			...(runtime.jobQueue ?? []),
		].sort((left, right) => left.id.localeCompare(right.id)),
		jobs: [
			...runtime.jobs,
		].sort((left, right) => left.id.localeCompare(right.id)),
	});
