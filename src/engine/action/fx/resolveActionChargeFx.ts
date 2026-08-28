import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { InputChargeFromEnumSchema } from "~/engine/input/schema/InputChargeFromEnumSchema";
import type { InputChargeSchema } from "~/engine/input/schema/InputChargeSchema";
import type { InputChargeRunPlanSchema } from "~/engine/input/schema/run/InputChargeRunPlanSchema";
import { readItemRemainingChargesFx } from "~/engine/item/fx/readItemRemainingChargesFx";
import { readRuntimeItemByIdFx } from "~/engine/runtime/read/readRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace resolveActionChargeFx {
	export interface Props {
		readonly charges: InputChargeSchema.Type | undefined;
		readonly ownerItemId: IdSchema.Type;
		readonly reservedCharges: ReadonlyMap<IdSchema.Type, number>;
		readonly targetItemId?: IdSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}

	export interface Result {
		readonly ready: boolean;
		readonly plan?: InputChargeRunPlanSchema.Type;
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

	const itemId =
		charges.from === InputChargeFromEnumSchema.enum.Self ? ownerItemId : targetItemId;
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
