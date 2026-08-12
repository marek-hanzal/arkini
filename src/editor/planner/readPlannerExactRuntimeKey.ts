import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

const normalizeValue = (value: unknown): unknown => {
	if (Array.isArray(value)) return value.map(normalizeValue);
	if (value === null || typeof value !== "object") return value;
	return Object.fromEntries(
		Object.entries(value)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([key, entry]) => [
				key,
				normalizeValue(entry),
			]),
	);
};

/**
 * Identity-preserving key for exact runtime revisits.
 *
 * Unlike the later canonical planner fingerprint, this key deliberately keeps every runtime ID,
 * owner/job/input relationship and concrete coordinate. It only omits item revisions because
 * those are concurrency tokens, not planner-visible gameplay state.
 */
export const readPlannerExactRuntimeKey = (runtime: RuntimeSchema.Type) =>
	JSON.stringify(
		normalizeValue({
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
		}),
	);
