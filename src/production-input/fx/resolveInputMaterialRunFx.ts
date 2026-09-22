import { Effect } from "effect";

import { resolveActionUnitFx } from "~/production-action/fx/resolveActionUnitFx";
import { resolveInputMaterialFn } from "~/production-input/fn/resolveInputMaterialFn";
import type { InputRun } from "~/production-input/type/InputRun";
import type { MaterialSchema } from "~/production-input/schema/MaterialSchema";
import type { InputRuntimeItemSchema } from "~/game-runtime/schema/InputRuntimeItemSchema";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace resolveInputMaterialRunFx {
	export interface Props {
		input: MaterialSchema.Type;
		items: InputRuntimeItemSchema.Type[];
		ownerItemId: IdSchema.Type;
		reservedUnits: ReadonlyMap<IdSchema.Type, number>;
		runtime: RuntimeSchema.Type;
	}
}

const planInputMaterialRunFn = ({
	items,
	resolution,
	units,
}: {
	readonly items: InputRuntimeItemSchema.Type[];
	readonly resolution: InputRun.MaterialResolution;
	readonly units?: InputRun.UnitPlan;
}) => {
	if (!resolution.ready) return undefined;

	const [firstItem, ...remainingItems] = items.slice(0, resolution.runQuantity).map((item) => ({
		itemId: item.id,
	}));
	if (items.length < resolution.runQuantity || firstItem === undefined) return undefined;

	return {
		type: resolution.type,
		mode: resolution.mode,
		quantity: resolution.runQuantity,
		units,
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
	reservedUnits,
	runtime,
}: resolveInputMaterialRunFx.Props) {
	const storedQuantity = items.length;
	const materialResolution = resolveInputMaterialFn({
		input,
		storedQuantity,
	});
	const units = yield* resolveActionUnitFx({
		units: input.units,
		ownerItemId,
		reservedUnits,
		runtime,
	});
	const resolution = {
		...materialResolution,
		ready: materialResolution.ready && units.ready,
	};
	const plan = planInputMaterialRunFn({
		items,
		resolution,
		units: units.plan,
	});

	return {
		resolution,
		plan,
	} satisfies InputRun.Resolution;
});
