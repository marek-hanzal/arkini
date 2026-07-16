import { Effect } from "effect";

import { resolveInputMaterialFx } from "~/engine/input/fx/resolveInputMaterialFx";
import type { InputMaterialSchema } from "~/engine/input/schema/InputMaterialSchema";
import type { InputRunResolutionSchema } from "~/engine/input/schema/run/InputRunResolutionSchema";
import type { InputRuntimeItemSchema } from "~/engine/runtime/schema/InputRuntimeItemSchema";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { planInputMaterialRunFx } from "./planInputMaterialRunFx";
import { resolveInputChargeRunFx } from "./resolveInputChargeRunFx";

export namespace resolveInputMaterialRunFx {
	export interface Props {
		input: InputMaterialSchema.Type;
		items: InputRuntimeItemSchema.Type[];
		ownerItemId: IdSchema.Type;
		reservedCharges: ReadonlyMap<IdSchema.Type, number>;
		runtime: RuntimeSchema.Type;
	}
}

/**
 * Resolves one material input and prepares its exact allocation when ready.
 */
export const resolveInputMaterialRunFx = Effect.fn("resolveInputMaterialRunFx")(function* ({
	input,
	items,
	ownerItemId,
	reservedCharges,
	runtime,
}: resolveInputMaterialRunFx.Props) {
	const storedQuantity = items.reduce((quantity, item) => {
		return quantity + item.quantity;
	}, 0);
	const materialResolution = yield* resolveInputMaterialFx({
		input,
		storedQuantity,
	});
	const charges = yield* resolveInputChargeRunFx({
		charges: input.charges,
		ownerItemId,
		reservedCharges,
		runtime,
	});
	const resolution = {
		...materialResolution,
		ready: materialResolution.ready && charges.ready,
	};
	const plan = yield* planInputMaterialRunFx({
		items,
		resolution,
		charges: charges.plan,
	});

	return {
		resolution,
		plan,
	} satisfies InputRunResolutionSchema.Type;
});
