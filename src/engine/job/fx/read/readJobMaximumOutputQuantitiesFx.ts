import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { JobSchema } from "~/engine/job/schema/JobSchema";
import { readItemLineFx } from "~/engine/line/fx/readItemLineFx";
import { readOutputMaximumQuantitiesFx } from "~/engine/output/fx/readOutputMaximumQuantitiesFx";
import { readRuntimeItemByIdFx } from "~/engine/runtime/read/readRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";

export namespace readJobMaximumOutputQuantitiesFx {
	export interface Props {
		job: JobSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

const addQuantities = (
	target: Map<IdSchema.Type, number>,
	source: ReadonlyMap<IdSchema.Type, number>,
) => {
	for (const [itemId, quantity] of source) {
		target.set(itemId, (target.get(itemId) ?? 0) + quantity);
	}
};

const subtractQuantity = (
	quantities: Map<IdSchema.Type, number>,
	itemId: IdSchema.Type,
	quantity: number,
) => {
	const netQuantity = Math.max(0, (quantities.get(itemId) ?? 0) - quantity);
	if (netQuantity === 0) quantities.delete(itemId);
	else quantities.set(itemId, netQuantity);
};

/** Reads the per-item worst-case net quantity increase reserved by one active job. */
export const readJobMaximumOutputQuantitiesFx = Effect.fn("readJobMaximumOutputQuantitiesFx")(
	function* ({ job, runtime }: readJobMaximumOutputQuantitiesFx.Props) {
		const owner = yield* readRuntimeItemByIdFx({
			itemId: job.ownerItemId,
			runtime,
		});
		const line = yield* readItemLineFx({
			item: owner.item,
			lineId: job.lineId,
		});
		if (line === undefined) {
			return yield* Effect.dieMessage(`Job ${job.id} line ${job.lineId} is missing.`);
		}

		const quantities = new Map<IdSchema.Type, number>();
		if (line.output !== undefined) {
			addQuantities(
				quantities,
				yield* readOutputMaximumQuantitiesFx({
					output: line.output,
				}),
			);
		}

		const depleted = owner.item.charges !== undefined && owner.remainingCharges === 0;
		if (depleted && owner.item.charges?.output !== undefined) {
			addQuantities(
				quantities,
				yield* readOutputMaximumQuantitiesFx({
					output: owner.item.charges.output,
				}),
			);
		}

		for (const item of runtime.items) {
			if (
				item.location.scope === LocationScopeEnumSchema.enum.Job &&
				item.location.jobId === job.id
			) {
				subtractQuantity(quantities, item.item.id, item.quantity);
			}
		}

		if (depleted) {
			subtractQuantity(quantities, owner.item.id, owner.quantity);
		}

		return quantities;
	},
);
