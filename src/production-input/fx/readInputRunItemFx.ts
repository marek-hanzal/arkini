import { Effect, Option } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";
import type { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";
import { InputRunPlanInvalidError } from "~/production-input/error/InputRunPlanInvalidError";
import { narrowInputRuntimeItemFn } from "~/production-input/fn/narrowInputRuntimeItemFn";
import { readRuntimeItemByIdFx } from "~/game-runtime/fx/readRuntimeItemByIdFx";
import type { InputRuntimeItemSchema } from "~/game-runtime/schema/InputRuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace readInputRunItemFx {
	export interface Props {
		ownerItemId: IdSchema.Type;
		lineId: IdSchema.Type;
		inputIndex: NonNegativeIntegerSchema.Type;
		itemId: IdSchema.Type;
		plannedQuantity: PositiveIntegerSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Reads one exact buffered item allocation from a line-run plan. */
export const readInputRunItemFx = Effect.fn("readInputRunItemFx")(function* ({
	ownerItemId,
	lineId,
	inputIndex,
	itemId,
	plannedQuantity,
	runtime,
}: readInputRunItemFx.Props) {
	const runtimeItem = yield* readRuntimeItemByIdFx({
		itemId,
		runtime,
	});
	const item = Option.getOrUndefined(narrowInputRuntimeItemFn(runtimeItem));
	const validLocation =
		item !== undefined &&
		item.location.ownerItemId === ownerItemId &&
		item.location.lineId === lineId &&
		item.location.inputIndex === inputIndex;
	if (!validLocation || item === undefined || item.quantity < plannedQuantity) {
		return yield* Effect.fail(
			new InputRunPlanInvalidError({
				ownerItemId,
				lineId,
				inputIndex,
				itemId,
				plannedQuantity,
				availableQuantity: runtimeItem.quantity,
			}),
		);
	}

	return item satisfies InputRuntimeItemSchema.Type;
});
