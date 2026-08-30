import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { JobSchema } from "~/production-job/schema/JobSchema";
import { readItemLineFn } from "~/production-line/fn/readItemLineFn";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import { readOutputMaximumQuantitiesFn } from "~/production-output/fn/readOutputMaximumQuantitiesFn";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";

const addQuantitiesFn = (
	target: Map<IdSchema.Type, number>,
	source: ReadonlyMap<IdSchema.Type, number>,
) => {
	for (const [itemId, quantity] of source) {
		target.set(itemId, (target.get(itemId) ?? 0) + quantity);
	}
};

const subtractQuantityFn = (
	quantities: Map<IdSchema.Type, number>,
	itemId: IdSchema.Type,
	quantity: number,
) => {
	const netQuantity = Math.max(0, (quantities.get(itemId) ?? 0) - quantity);
	if (netQuantity === 0) quantities.delete(itemId);
	else quantities.set(itemId, netQuantity);
};

const readJobMaximumOutputQuantitiesFn = ({
	job,
	line,
	owner,
	runtime,
}: {
	readonly job: JobSchema.Type;
	readonly line: LineSchema.Type;
	readonly owner: RuntimeItemSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}) => {
	const quantities = new Map<IdSchema.Type, number>();
	if (line.output !== undefined) {
		addQuantitiesFn(
			quantities,
			readOutputMaximumQuantitiesFn({
				output: line.output,
			}),
		);
	}

	const depleted = owner.item.charges !== undefined && owner.remainingCharges === 0;
	if (depleted && owner.item.charges?.output !== undefined) {
		addQuantitiesFn(
			quantities,
			readOutputMaximumQuantitiesFn({
				output: owner.item.charges.output,
			}),
		);
	}

	for (const item of runtime.items) {
		if (
			item.location.scope === LocationScopeEnumSchema.enum.Job &&
			item.location.jobId === job.id
		) {
			subtractQuantityFn(quantities, item.item.id, item.quantity);
		}
	}

	if (depleted) {
		subtractQuantityFn(quantities, owner.item.id, owner.quantity);
	}

	return quantities;
};

interface ReservedJobOutputQuantity {
	jobIds: IdSchema.Type[];
	quantity: number;
}

export namespace readReservedJobOutputQuantitiesFn {
	export interface Props {
		runtime: RuntimeSchema.Type;
	}
}

/** Reads worst-case future output reservations aggregated across valid active jobs. */
export const readReservedJobOutputQuantitiesFn = ({
	runtime,
}: readReservedJobOutputQuantitiesFn.Props) => {
	const reserved = new Map<IdSchema.Type, ReservedJobOutputQuantity>();

	for (const job of runtime.jobs) {
		const owner = runtime.items.find((item) => item.id === job.ownerItemId);
		if (owner === undefined) continue;
		const line = readItemLineFn({
			item: owner.item,
			lineId: job.lineId,
		});
		if (line === undefined) continue;

		const quantities = readJobMaximumOutputQuantitiesFn({
			job,
			line,
			owner,
			runtime,
		});
		for (const [itemId, quantity] of quantities) {
			if (quantity <= 0) continue;
			const current = reserved.get(itemId);
			reserved.set(itemId, {
				jobIds:
					current === undefined
						? [
								job.id,
							]
						: [
								...current.jobIds,
								job.id,
							],
				quantity: (current?.quantity ?? 0) + quantity,
			});
		}
	}

	return reserved;
};
