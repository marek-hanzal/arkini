import type { IdSchema } from "~/game-config/schema/IdSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export interface ItemPurityIndex {
	readonly inputLineIdsByOwnerId: ReadonlyMap<IdSchema.Type, ReadonlySet<IdSchema.Type>>;
	readonly jobLineIdsByOwnerId: ReadonlyMap<IdSchema.Type, ReadonlySet<IdSchema.Type>>;
	readonly queueLineIdsByOwnerId: ReadonlyMap<IdSchema.Type, ReadonlySet<IdSchema.Type>>;
}

const addOwnedLineFn = (
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
			addOwnedLineFn(inputLineIdsByOwnerId, item.location.ownerItemId, item.location.lineId);
			continue;
		}
		if (
			item.location.scope === LocationScopeEnumSchema.enum.Delivery &&
			item.location.phase === "outbound"
		) {
			addOwnedLineFn(
				inputLineIdsByOwnerId,
				item.location.target.ownerItemId,
				item.location.target.lineId,
			);
		}
	}
	for (const job of runtime.jobs) {
		addOwnedLineFn(jobLineIdsByOwnerId, job.ownerItemId, job.lineId);
	}
	for (const request of runtime.jobQueue) {
		addOwnedLineFn(queueLineIdsByOwnerId, request.ownerItemId, request.lineId);
	}
	return {
		inputLineIdsByOwnerId,
		jobLineIdsByOwnerId,
		queueLineIdsByOwnerId,
	} satisfies ItemPurityIndex;
};
