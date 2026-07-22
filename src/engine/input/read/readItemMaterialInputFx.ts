import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import { InputMaterialNotFoundError } from "~/engine/input/error/InputMaterialNotFoundError";
import type { InputMaterialSchema } from "~/engine/input/schema/InputMaterialSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import { LineNotFoundError } from "~/engine/line/error/LineNotFoundError";
import { readItemLineFx } from "~/engine/line/fx/readItemLineFx";
import { InputEnumSchema } from "~/engine/input/schema/InputEnumSchema";

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
	const line = yield* readItemLineFx({
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
	if (input === undefined || input.type !== InputEnumSchema.enum.Materials) {
		return yield* Effect.fail(
			new InputMaterialNotFoundError({
				ownerItemId,
				lineId,
				inputIndex,
			}),
		);
	}

	return input satisfies InputMaterialSchema.Type;
});
