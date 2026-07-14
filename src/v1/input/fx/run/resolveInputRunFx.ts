import { Effect } from "effect";
import { match } from "ts-pattern";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/v1/common/schema/NonNegativeIntegerSchema";
import { filterInputMaterialItems } from "~/v1/input/read/filterInputMaterialItems";
import type { InputSchema } from "~/v1/input/schema/InputSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { resolveInputMaterialRunFx } from "./resolveInputMaterialRunFx";
import { resolveInputSimpleRunFx } from "./resolveInputSimpleRunFx";
import { resolveInputDepositRunFx } from "./resolveInputDepositRunFx";

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
				type: "simple",
			},
			(input) => {
				return resolveInputSimpleRunFx({
					input,
					ownerItemId,
					reservedCharges,
					runtime,
				});
			},
		)
		.with(
			{
				type: "materials",
			},
			(input) => {
				return resolveInputMaterialRunFx({
					input,
					ownerItemId,
					reservedCharges,
					runtime,
					items: filterInputMaterialItems({
						inputIndex,
						items: runtime.items,
						lineId,
						ownerItemId,
					}),
				});
			},
		)
		.with(
			{
				type: "deposit",
			},
			(input) => {
				return resolveInputDepositRunFx({
					input,
					ownerItemId,
					reservedCharges,
					runtime,
				});
			},
		)
		.exhaustive();
});
