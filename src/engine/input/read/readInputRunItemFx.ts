import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import { InputRunPlanInvalidError } from "~/engine/input/error/InputRunPlanInvalidError";
import { isInputRuntimeItem } from "~/engine/runtime/read/isInputRuntimeItem";
import { readRuntimeItemByIdFx } from "~/engine/runtime/read/readRuntimeItemByIdFx";
import type { InputRuntimeItemSchema } from "~/engine/runtime/schema/InputRuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

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
	const item = yield* readRuntimeItemByIdFx({
		itemId,
		runtime,
	});
	const validLocation =
		isInputRuntimeItem(item) &&
		item.location.ownerItemId === ownerItemId &&
		item.location.lineId === lineId &&
		item.location.inputIndex === inputIndex;
	if (!validLocation || item.quantity < plannedQuantity) {
		return yield* Effect.fail(
			new InputRunPlanInvalidError({
				ownerItemId,
				lineId,
				inputIndex,
				itemId,
				plannedQuantity,
				availableQuantity: item.quantity,
			}),
		);
	}

	return item satisfies InputRuntimeItemSchema.Type;
});
