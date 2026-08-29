import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import { InputMaterialNotFoundError } from "~/production-input/error/InputMaterialNotFoundError";
import type { MaterialSchema } from "~/production-input/schema/MaterialSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import { LineNotFoundError } from "~/production-line/error/LineNotFoundError";
import { readItemLineFn } from "~/production-line/fn/readItemLineFn";
import { TypeSchema } from "~/production-input/schema/TypeSchema";

export namespace readItemMaterialInputFx {
	export interface Props {
		inputIndex: NonNegativeIntegerSchema.Type;
		item: ItemSchema.Type;
		lineId: IdSchema.Type;
		ownerItemId: IdSchema.Type;
	}
}

/**
 * Reads one configured material input from one canonical line-owning item.
 */
export const readItemMaterialInputFx = Effect.fn("readItemMaterialInputFx")(function* ({
	inputIndex,
	item,
	lineId,
	ownerItemId,
}: readItemMaterialInputFx.Props) {
	const line = readItemLineFn({
		item,
		lineId,
	});
	if (line === undefined) {
		return yield* Effect.fail(
			new LineNotFoundError({
				itemId: ownerItemId,
				lineId,
			}),
		);
	}

	const input = line.input[inputIndex];
	if (input === undefined || input.type !== TypeSchema.enum.Materials) {
		return yield* Effect.fail(
			new InputMaterialNotFoundError({
				ownerItemId,
				lineId,
				inputIndex,
			}),
		);
	}

	return input satisfies MaterialSchema.Type;
});
