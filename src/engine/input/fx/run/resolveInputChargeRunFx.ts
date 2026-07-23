import { Effect } from "effect";

import { InputChargeFromEnumSchema } from "~/engine/input/schema/InputChargeFromEnumSchema";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { InputChargeSchema } from "~/engine/input/schema/InputChargeSchema";
import type { InputChargeRunPlanSchema } from "~/engine/input/schema/run/InputChargeRunPlanSchema";
import { readItemRemainingChargesFx } from "~/engine/item/fx/readItemRemainingChargesFx";
import { readRuntimeItemByIdFx } from "~/engine/runtime/read/readRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace resolveInputChargeRunFx {
	export interface Props {
		charges: InputChargeSchema.Type | undefined;
		ownerItemId: IdSchema.Type;
		reservedCharges: ReadonlyMap<IdSchema.Type, number>;
		targetItemId?: IdSchema.Type;
		runtime: RuntimeSchema.Type;
	}

	export interface Result {
		ready: boolean;
		plan?: InputChargeRunPlanSchema.Type;
	}
}

/** Resolves one optional input charge cost against costs already reserved by earlier inputs. */
export const resolveInputChargeRunFx = Effect.fn("resolveInputChargeRunFx")(function* ({
	charges,
	ownerItemId,
	reservedCharges,
	targetItemId,
	runtime,
}: resolveInputChargeRunFx.Props) {
	if (charges === undefined) {
		return {
			ready: true,
		} satisfies resolveInputChargeRunFx.Result;
	}

	const itemId =
		charges.from === InputChargeFromEnumSchema.enum.Self ? ownerItemId : targetItemId;
	if (itemId === undefined) {
		return {
			ready: false,
		} satisfies resolveInputChargeRunFx.Result;
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
		} satisfies resolveInputChargeRunFx.Result;
	}

	return {
		ready: true,
		plan: {
			itemId,
			cost: charges.cost,
		},
	} satisfies resolveInputChargeRunFx.Result;
});
