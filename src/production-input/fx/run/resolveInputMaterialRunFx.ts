import { Array, Effect } from "effect";

import { resolveActionChargeFx } from "~/production-action/fx/resolveActionChargeFx";
import { resolveInputMaterialFn } from "~/production-input/fn/resolveInputMaterialFn";
import type { InputRun } from "~/production-input/InputRun";
import type { MaterialSchema } from "~/production-input/schema/MaterialSchema";
import type { InputRuntimeItemSchema } from "~/game-runtime/schema/InputRuntimeItemSchema";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace resolveInputMaterialRunFx {
	export interface Props {
		input: MaterialSchema.Type;
		items: InputRuntimeItemSchema.Type[];
		ownerItemId: IdSchema.Type;
		reservedCharges: ReadonlyMap<IdSchema.Type, number>;
		runtime: RuntimeSchema.Type;
	}
}

const planInputMaterialRunFn = ({
	items,
	resolution,
	charges,
}: {
	readonly items: InputRuntimeItemSchema.Type[];
	readonly resolution: InputRun.MaterialResolution;
	readonly charges?: InputRun.ChargePlan;
}) => {
	if (!resolution.ready) return undefined;

	const [remainingQuantity, allocation] = Array.mapAccum(
		items,
		resolution.runQuantity,
		(remaining, item) => {
			const quantity = Math.min(remaining, item.quantity);
			return [
				remaining - quantity,
				quantity > 0
					? {
							itemId: item.id,
							quantity,
						}
					: undefined,
			] as const;
		},
	);
	const [firstItem, ...remainingItems] = allocation.filter((item) => item !== undefined);
	if (remainingQuantity > 0 || firstItem === undefined) return undefined;

	return {
		type: resolution.type,
		mode: resolution.mode,
		quantity: resolution.runQuantity,
		charges,
		item: [
			firstItem,
			...remainingItems,
		],
	} satisfies InputRun.MaterialPlan;
};

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
	const materialResolution = resolveInputMaterialFn({
		input,
		storedQuantity,
	});
	const charges = yield* resolveActionChargeFx({
		charges: input.charges,
		ownerItemId,
		reservedCharges,
		runtime,
	});
	const resolution = {
		...materialResolution,
		ready: materialResolution.ready && charges.ready,
	};
	const plan = planInputMaterialRunFn({
		items,
		resolution,
		charges: charges.plan,
	});

	return {
		resolution,
		plan,
	} satisfies InputRun.Resolution;
});
