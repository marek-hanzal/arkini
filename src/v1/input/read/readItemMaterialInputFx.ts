import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/v1/common/schema/NonNegativeIntegerSchema";
import { InputMaterialNotFoundError } from "~/v1/input/error/InputMaterialNotFoundError";
import type { InputMaterialSchema } from "~/v1/input/schema/InputMaterialSchema";
import type { ItemSchema } from "~/v1/item/schema/ItemSchema";
import { LineNotFoundError } from "~/v1/line/error/LineNotFoundError";
import { readItemLineFx } from "~/v1/line/fx/readItemLineFx";

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
	if (input === undefined || input.type !== "materials") {
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
