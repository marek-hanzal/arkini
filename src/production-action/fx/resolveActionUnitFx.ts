import { Effect } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { InputRun } from "~/production-input/type/InputRun";
import { UnitSourceSchema } from "~/production-input/schema/UnitSourceSchema";
import type { UnitCostSchema } from "~/production-input/schema/UnitCostSchema";
import { readItemRemainingUnitsFn } from "~/production-action/fn/readItemRemainingUnitsFn";
import { readRuntimeItemByIdFx } from "~/game-runtime/fx/readRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace resolveActionUnitFx {
	export interface Props {
		readonly units: UnitCostSchema.Type | undefined;
		readonly ownerItemId: IdSchema.Type;
		readonly reservedUnits: ReadonlyMap<IdSchema.Type, number>;
		readonly targetItemId?: IdSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}

	export interface Result {
		readonly ready: boolean;
		readonly plan?: InputRun.UnitPlan;
	}
}

/** Reserves one optional action cost against the same immutable runtime snapshot. */
export const resolveActionUnitFx = Effect.fn("resolveActionUnitFx")(function* ({
	units,
	ownerItemId,
	reservedUnits,
	targetItemId,
	runtime,
}: resolveActionUnitFx.Props) {
	if (units === undefined) {
		return {
			ready: true,
		} satisfies resolveActionUnitFx.Result;
	}

	const itemId = units.from === UnitSourceSchema.enum.Self ? ownerItemId : targetItemId;
	if (itemId === undefined) {
		return {
			ready: false,
		} satisfies resolveActionUnitFx.Result;
	}

	const item = yield* readRuntimeItemByIdFx({
		itemId,
		runtime,
	});
	const remainingUnits = readItemRemainingUnitsFn(item);
	const reservedCost = reservedUnits.get(itemId) ?? 0;
	if (remainingUnits === undefined || remainingUnits - reservedCost < units.cost) {
		return {
			ready: false,
		} satisfies resolveActionUnitFx.Result;
	}
	// An idle external payer cannot be removed while its queue owns the identity.
	// Include earlier input costs; self starts and active payers retain a job through depletion.
	if (
		itemId !== ownerItemId &&
		remainingUnits === reservedCost + units.cost &&
		runtime.jobQueue.some((request) => request.ownerItemId === itemId) &&
		!runtime.jobs.some((job) => job.ownerItemId === itemId)
	) {
		return {
			ready: false,
		} satisfies resolveActionUnitFx.Result;
	}

	return {
		ready: true,
		plan: {
			itemId,
			cost: units.cost,
		},
	} satisfies resolveActionUnitFx.Result;
});
