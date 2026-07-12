import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/v1/common/schema/NonNegativeIntegerSchema";
import type { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import { InputRunPlanInvalidError } from "~/v1/input/error/InputRunPlanInvalidError";
import { isInputRuntimeItem } from "~/v1/runtime/read/isInputRuntimeItem";
import { readRuntimeItemByIdFx } from "~/v1/runtime/read/readRuntimeItemByIdFx";
import type { InputRuntimeItemSchema } from "~/v1/runtime/schema/InputRuntimeItemSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

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
