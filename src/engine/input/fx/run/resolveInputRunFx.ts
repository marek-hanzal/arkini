import { Effect } from "effect";
import { match } from "ts-pattern";

import { resolveActionInputFx } from "~/engine/action/fx/resolveActionInputFx";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import type { InputSchema } from "~/engine/input/schema/InputSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import type { InputRuntimeItemSchema } from "~/engine/runtime/schema/InputRuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { InputEnumSchema } from "~/engine/input/schema/InputEnumSchema";

import { resolveInputMaterialRunFx } from "./resolveInputMaterialRunFx";

export namespace resolveInputRunFx {
	export interface Props {
		input: InputSchema.Type;
		inputIndex: NonNegativeIntegerSchema.Type;
		lineId: IdSchema.Type;
		ownerItemId: IdSchema.Type;
		reservedCharges: ReadonlyMap<IdSchema.Type, number>;
		runtime: RuntimeSchema.Type;
	}
}

/**
 * Resolves and plans one configured input against one explicit runtime snapshot.
 */
export const resolveInputRunFx = Effect.fn("resolveInputRunFx")(function* ({
	input,
	inputIndex,
	lineId,
	ownerItemId,
	reservedCharges,
	runtime,
}: resolveInputRunFx.Props) {
	return yield* match(input)
		.with(
			{
				type: InputEnumSchema.enum.Simple,
			},
			(input) => {
				return resolveActionInputFx({
					input,
					ownerItemId,
					reservedCharges,
					runtime,
				});
			},
		)
		.with(
			{
				type: InputEnumSchema.enum.Materials,
			},
			(input) => {
				const materialItems = runtime.items.filter(
					(item): item is InputRuntimeItemSchema.Type =>
						item.location.scope === LocationScopeEnumSchema.enum.Input &&
						item.location.ownerItemId === ownerItemId &&
						item.location.lineId === lineId &&
						item.location.inputIndex === inputIndex,
				);
				return resolveInputMaterialRunFx({
					input,
					ownerItemId,
					reservedCharges,
					runtime,
					items: materialItems,
				});
			},
		)
		.with(
			{
				type: InputEnumSchema.enum.Deposit,
			},
			(input) => {
				return resolveActionInputFx({
					input,
					ownerItemId,
					reservedCharges,
					runtime,
				});
			},
		)
		.exhaustive();
});
