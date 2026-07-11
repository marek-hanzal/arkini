import { Effect } from "effect";
import { match } from "ts-pattern";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/v1/common/schema/NonNegativeIntegerSchema";
import { InputRunUnsupportedError } from "~/v1/input/error/InputRunUnsupportedError";
import { filterInputMaterialItems } from "~/v1/input/read/filterInputMaterialItems";
import type { InputSchema } from "~/v1/input/schema/InputSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { resolveInputMaterialRunFx } from "./resolveInputMaterialRunFx";
import { resolveInputSimpleRunFx } from "./resolveInputSimpleRunFx";

export namespace resolveInputRunFx {
	export interface Props {
		input: InputSchema.Type;
		inputIndex: NonNegativeIntegerSchema.Type;
		lineId: IdSchema.Type;
		ownerItemId: IdSchema.Type;
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
				return Effect.fail(
					new InputRunUnsupportedError({
						inputIndex,
						lineId,
						ownerItemId,
						type: input.type,
					}),
				);
			},
		)
		.exhaustive();
});
