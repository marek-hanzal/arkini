import { Effect } from "effect";
import { match, P } from "ts-pattern";
import type { GameSaveInventorySlot } from "~/engine/model/GameSaveSchema";
import { isGameSaveInventoryStack } from "~/inventory/model/GameSaveInventorySlot";

export namespace readInventoryStackCapacityFx {
	export interface Props {
		itemId: string;
		maxStackSize: number;
		slots: GameSaveInventorySlot[];
	}
}

export const readInventoryStackCapacityFx = Effect.fn("readInventoryStackCapacityFx")(function* ({
	itemId,
	maxStackSize,
	slots,
}: readInventoryStackCapacityFx.Props) {
	return slots.reduce((capacity, slot) => {
		return match(slot)
			.with(null, () => capacity + maxStackSize)
			.with(P.when(isGameSaveInventoryStack), (stack) =>
				stack.itemId === itemId
					? capacity + Math.max(0, maxStackSize - stack.quantity)
					: capacity,
			)
			.otherwise(() => capacity);
	}, 0);
});
