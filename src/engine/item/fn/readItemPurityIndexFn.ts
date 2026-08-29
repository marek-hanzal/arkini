import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export interface ItemPurityIndex {
	readonly inputLineIdsByOwnerId: ReadonlyMap<IdSchema.Type, ReadonlySet<IdSchema.Type>>;
	readonly jobLineIdsByOwnerId: ReadonlyMap<IdSchema.Type, ReadonlySet<IdSchema.Type>>;
	readonly queueLineIdsByOwnerId: ReadonlyMap<IdSchema.Type, ReadonlySet<IdSchema.Type>>;
}

const addOwnedLine = (
	index: Map<IdSchema.Type, Set<IdSchema.Type>>,
	ownerItemId: IdSchema.Type,
	lineId: IdSchema.Type,
) => {
	const lineIds = index.get(ownerItemId);
	if (lineIds === undefined) {
		index.set(
			ownerItemId,
			new Set([
				lineId,
			]),
		);
	} else {
		lineIds.add(lineId);
	}
};

/** Indexes identity-bound line state once for repeated purity checks over one runtime snapshot. */
export const readItemPurityIndexFn = (runtime: RuntimeSchema.Type) => {
	const inputLineIdsByOwnerId = new Map<IdSchema.Type, Set<IdSchema.Type>>();
	const jobLineIdsByOwnerId = new Map<IdSchema.Type, Set<IdSchema.Type>>();
	const queueLineIdsByOwnerId = new Map<IdSchema.Type, Set<IdSchema.Type>>();
	for (const item of runtime.items) {
		if (item.location.scope === LocationScopeEnumSchema.enum.Input) {
			addOwnedLine(inputLineIdsByOwnerId, item.location.ownerItemId, item.location.lineId);
			continue;
		}
		if (
			item.location.scope === LocationScopeEnumSchema.enum.Delivery &&
			item.location.phase === "outbound"
		) {
			addOwnedLine(
				inputLineIdsByOwnerId,
				item.location.target.ownerItemId,
				item.location.target.lineId,
			);
		}
	}
	for (const job of runtime.jobs) {
		addOwnedLine(jobLineIdsByOwnerId, job.ownerItemId, job.lineId);
	}
	for (const request of runtime.jobQueue) {
		addOwnedLine(queueLineIdsByOwnerId, request.ownerItemId, request.lineId);
	}
	return {
		inputLineIdsByOwnerId,
		jobLineIdsByOwnerId,
		queueLineIdsByOwnerId,
	} satisfies ItemPurityIndex;
};
