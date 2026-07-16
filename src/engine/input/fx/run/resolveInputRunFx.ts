import { Effect } from "effect";
import { match } from "ts-pattern";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import { isInputRuntimeItem } from "~/engine/runtime/read/isInputRuntimeItem";
import type { InputSchema } from "~/engine/input/schema/InputSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
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
	const readMaterialItems = () => {
		return runtime.items.filter(isInputRuntimeItem).filter((item) => {
			return (
				item.location.ownerItemId === ownerItemId &&
				item.location.lineId === lineId &&
				item.location.inputIndex === inputIndex
			);
		});
	};

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
					items: readMaterialItems(),
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
