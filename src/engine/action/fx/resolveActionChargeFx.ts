import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { InputRun } from "~/engine/input/InputRun";
import { ChargeSourceSchema } from "~/engine/input/schema/ChargeSourceSchema";
import type { ChargeSchema } from "~/engine/input/schema/ChargeSchema";
import { readItemRemainingChargesFx } from "~/engine/item/fx/readItemRemainingChargesFx";
import { readRuntimeItemByIdFx } from "~/engine/runtime/read/readRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

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
	const remainingCharges = yield* readItemRemainingChargesFx(item);
	const reservedCost = reservedCharges.get(itemId) ?? 0;
	if (remainingCharges === undefined || remainingCharges - reservedCost < charges.cost) {
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
