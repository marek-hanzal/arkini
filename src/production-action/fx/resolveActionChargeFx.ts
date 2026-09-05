import { Effect } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { InputRun } from "~/production-input/type/InputRun";
import { ChargeSourceSchema } from "~/production-input/schema/ChargeSourceSchema";
import type { ChargeSchema } from "~/production-input/schema/ChargeSchema";
import { readItemRemainingChargesFn } from "~/production-action/fn/readItemRemainingChargesFn";
import { readRuntimeItemByIdFx } from "~/game-runtime/fx/readRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace resolveActionChargeFx {
	export interface Props {
		readonly charges: ChargeSchema.Type | undefined;
		readonly ownerItemId: IdSchema.Type;
		readonly reservedCharges: ReadonlyMap<IdSchema.Type, number>;
		readonly targetItemId?: IdSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}

	export interface Result {
		readonly ready: boolean;
		readonly plan?: InputRun.ChargePlan;
	}
}

/** Reserves one optional action cost against the same immutable runtime snapshot. */
export const resolveActionChargeFx = Effect.fn("resolveActionChargeFx")(function* ({
	charges,
	ownerItemId,
	reservedCharges,
	targetItemId,
	runtime,
}: resolveActionChargeFx.Props) {
	if (charges === undefined) {
		return {
			ready: true,
		} satisfies resolveActionChargeFx.Result;
	}

	const itemId = charges.from === ChargeSourceSchema.enum.Self ? ownerItemId : targetItemId;
	if (itemId === undefined) {
		return {
			ready: false,
		} satisfies resolveActionChargeFx.Result;
	}

	const item = yield* readRuntimeItemByIdFx({
		itemId,
		runtime,
	});
	const remainingCharges = readItemRemainingChargesFn(item);
	const reservedCost = reservedCharges.get(itemId) ?? 0;
	if (remainingCharges === undefined || remainingCharges - reservedCost < charges.cost) {
		return {
			ready: false,
		} satisfies resolveActionChargeFx.Result;
	}
	// An idle external payer cannot be removed while its queue owns the identity.
	// Include earlier input costs; self starts and active payers retain a job through depletion.
	if (
		itemId !== ownerItemId &&
		remainingCharges === reservedCost + charges.cost &&
		runtime.jobQueue.some((request) => request.ownerItemId === itemId) &&
		!runtime.jobs.some((job) => job.ownerItemId === itemId)
	) {
		return {
			ready: false,
		} satisfies resolveActionChargeFx.Result;
	}

	return {
		ready: true,
		plan: {
			itemId,
			cost: charges.cost,
		},
	} satisfies resolveActionChargeFx.Result;
});
