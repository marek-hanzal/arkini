import { stringifyPlannerCanonicalValue } from "~/editor/planner/stringifyPlannerCanonicalValue";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

const compareStrings = (left: string, right: string) => left.localeCompare(right);

const readGridLocation = (location: GridLocationSchema.Type) => {
	switch (location.scope) {
		case "board":
			return {
				position: location.position,
				scope: location.scope,
				space: location.space,
			};
		case "inventory":
		case "toolbar":
			return {
				position: location.position,
				scope: location.scope,
			};
	}
};

const readEffectiveRemainingCharges = (item: RuntimeItemSchema.Type) =>
	item.remainingCharges ?? item.item.charges?.amount ?? null;

const readEffectiveRemainingDurationMs = (item: RuntimeItemSchema.Type) =>
	item.remainingDurationMs ?? (item.item.type === "temporary" ? item.item.durationMs : null);

/**
 * Canonical, identity-free runtime fingerprint used to collapse isomorphic planner states.
 *
 * Generated item, job, request and revision IDs are replaced by the exact gameplay facts they
 * identify. Runtime coordinates remain present because canonical engine candidate selection still
 * uses them as deterministic tie-breakers. Owner, input, delivery, job, reservation, queue and
 * default-line relationships are embedded through stable structural references rather than erased.
 */
export const readPlannerRuntimeFingerprint = (runtime: RuntimeSchema.Type) => {
	const itemById = new Map(
		runtime.items.map((item) => [
			item.id,
			item,
		]),
	);
	const jobById = new Map(
		runtime.jobs.map((job) => [
			job.id,
			job,
		]),
	);
	const itemReferenceById = new Map<IdSchema.Type, unknown>();
	const jobReferenceById = new Map<IdSchema.Type, unknown>();

	const readItemReference = (runtimeItemId: IdSchema.Type): unknown => {
		const cached = itemReferenceById.get(runtimeItemId);
		if (cached !== undefined) return cached;
		const item = itemById.get(runtimeItemId);
		const reference =
			item === undefined
				? {
						missingRuntimeItemId: runtimeItemId,
					}
				: {
						itemId: item.item.id,
						location:
							item.location.scope === "board" ||
							item.location.scope === "inventory" ||
							item.location.scope === "toolbar"
								? readGridLocation(item.location)
								: {
										scope: item.location.scope,
									},
						quantity: item.quantity,
						remainingCharges: readEffectiveRemainingCharges(item),
						remainingDurationMs: readEffectiveRemainingDurationMs(item),
					};
		itemReferenceById.set(runtimeItemId, reference);
		return reference;
	};

	const readJobReference = (jobId: IdSchema.Type): unknown => {
		const cached = jobReferenceById.get(jobId);
		if (cached !== undefined) return cached;
		const job = jobById.get(jobId);
		const reference =
			job === undefined
				? {
						missingJobId: jobId,
					}
				: {
						durationMs: job.durationMs,
						lineId: job.lineId,
						owner: readItemReference(job.ownerItemId),
						remainingMs: job.remainingMs,
					};
		jobReferenceById.set(jobId, reference);
		return reference;
	};

	const readLocation = (item: RuntimeItemSchema.Type): unknown => {
		const location = item.location;
		switch (location.scope) {
			case "board":
			case "inventory":
			case "toolbar":
				return readGridLocation(location);
			case "input":
				return {
					inputIndex: location.inputIndex,
					lineId: location.lineId,
					owner: readItemReference(location.ownerItemId),
					scope: location.scope,
				};
			case "job":
			case "reserved":
				return {
					job: readJobReference(location.jobId),
					scope: location.scope,
				};
			case "delivery":
				return location.phase === "outbound"
					? {
							generation: location.generation,
							origin: readGridLocation(location.origin),
							phase: location.phase,
							scope: location.scope,
							target: {
								input: location.target.input,
								kind: location.target.kind,
								lineId: location.target.lineId,
								owner: readItemReference(location.target.ownerItemId),
							},
						}
					: {
							generation: location.generation,
							origin: readGridLocation(location.origin),
							phase: location.phase,
							returnFrom: readGridLocation(location.returnFrom),
							scope: location.scope,
						};
		}
	};

	const items = runtime.items
		.map((item) =>
			stringifyPlannerCanonicalValue({
				itemId: item.item.id,
				location: readLocation(item),
				quantity: item.quantity,
				remainingCharges: readEffectiveRemainingCharges(item),
				remainingDurationMs: readEffectiveRemainingDurationMs(item),
			}),
		)
		.sort(compareStrings);
	const jobs = runtime.jobs
		.map((job) => stringifyPlannerCanonicalValue(readJobReference(job.id)))
		.sort(compareStrings);
	const defaultLines = Object.entries(runtime.defaultLineByOwnerItemId ?? {})
		.map(([ownerItemId, lineId]) =>
			stringifyPlannerCanonicalValue({
				lineId,
				owner: readItemReference(ownerItemId),
			}),
		)
		.sort(compareStrings);
	const queue = (runtime.jobQueue ?? []).map((request) => ({
		lineId: request.lineId,
		owner: readItemReference(request.ownerItemId),
	}));

	return stringifyPlannerCanonicalValue({
		cheats: runtime.cheats,
		currentSpace: runtime.currentSpace,
		defaultLines,
		items,
		jobs,
		queue,
	});
};
