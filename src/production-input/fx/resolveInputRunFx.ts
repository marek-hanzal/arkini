import { Effect } from "effect";
import { match } from "ts-pattern";

import { resolveActionInputFx } from "~/production-action/fx/resolveActionInputFx";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";
import type { InputSchema } from "~/production-input/schema/InputSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import type { InputRuntimeItemSchema } from "~/game-runtime/schema/InputRuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { TypeSchema } from "~/production-input/schema/TypeSchema";

import { resolveInputMaterialRunFx } from "./resolveInputMaterialRunFx";

export namespace resolveInputRunFx {
	export interface Props {
		input: InputSchema.Type;
		inputIndex: NonNegativeIntegerSchema.Type;
		lineId: IdSchema.Type;
		ownerItemId: IdSchema.Type;
		reservedUnits: ReadonlyMap<IdSchema.Type, number>;
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
	reservedUnits,
	runtime,
}: resolveInputRunFx.Props) {
	return yield* match(input)
		.with(
			{
				type: TypeSchema.enum.Simple,
			},
			(input) => {
				return resolveActionInputFx({
					input,
					ownerItemId,
					reservedUnits,
					runtime,
				});
			},
		)
		.with(
			{
				type: TypeSchema.enum.Materials,
			},
			(input) => {
				const materialItems = runtime.items.filter(
					(item): item is InputRuntimeItemSchema.Type =>
						item.location.scope === LocationScopeEnumSchema.enum.Input &&
						item.location.ownerItemId === ownerItemId &&
						item.location.lineId === lineId &&
						item.location.inputIndex === inputIndex &&
						item.schedule?.remainingDurationMs !== 0,
				);
				return resolveInputMaterialRunFx({
					input,
					ownerItemId,
					reservedUnits,
					runtime,
					items: materialItems,
				});
			},
		)
		.with(
			{
				type: TypeSchema.enum.Units,
			},
			(input) => {
				return resolveActionInputFx({
					input,
					ownerItemId,
					reservedUnits,
					runtime,
				});
			},
		)
		.exhaustive();
});
