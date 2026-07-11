import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/v1/common/schema/NonNegativeIntegerSchema";
import { resolveInputMaterialFx } from "~/v1/input/fx/resolveInputMaterialFx";
import type { InputMaterialResolutionSchema } from "~/v1/input/schema/resolution/InputMaterialResolutionSchema";
import { getItemFx } from "~/v1/runtime/read/getItemFx";
import { readInputMaterialItemsFx } from "./readInputMaterialItemsFx";
import { readItemMaterialInputFx } from "./readItemMaterialInputFx";

export namespace resolveInputMaterialSlotFx {
	export interface Props {
		ownerItemId: IdSchema.Type;
		lineId: IdSchema.Type;
		inputIndex: NonNegativeIntegerSchema.Type;
	}
}

/**
 * Resolves the current readiness and capacity of one concrete material input slot.
 */
export const resolveInputMaterialSlotFx = Effect.fn("resolveInputMaterialSlotFx")(function* ({
	ownerItemId,
	lineId,
	inputIndex,
}: resolveInputMaterialSlotFx.Props) {
	const owner = yield* getItemFx({
		itemId: ownerItemId,
	});
	const input = yield* readItemMaterialInputFx({
		inputIndex,
		item: owner.item,
		lineId,
		ownerItemId,
	});

	const items = yield* readInputMaterialItemsFx({
		ownerItemId,
		lineId,
		inputIndex,
	});
	const storedQuantity = items.reduce((quantity, item) => {
		return quantity + item.quantity;
	}, 0);

	return (yield* resolveInputMaterialFx({
		input,
		storedQuantity,
	})) satisfies InputMaterialResolutionSchema.Type;
});
