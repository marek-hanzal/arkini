import { Effect } from "effect";
import { match, P } from "ts-pattern";
import type { GameSaveInventorySlot, GameSaveInventoryStack } from "~/engine/model/GameSaveSchema";
import {
	isGameSaveInventoryInstance,
	isGameSaveInventoryStack,
} from "~/inventory/model/GameSaveInventorySlot";

export namespace readInventorySlotAfterQuantityRemovalFx {
	export interface Props {
		quantity: number;
		slot: GameSaveInventorySlot;
	}
}

const readRemainingStackAfterQuantityRemovalFx = Effect.fn(
	"readInventorySlotAfterQuantityRemovalFx.readRemainingStackAfterQuantityRemovalFx",
)(function* ({ quantity, stack }: { quantity: number; stack: GameSaveInventoryStack }) {
	const nextQuantity = stack.quantity - quantity;
	if (nextQuantity <= 0) return null;
	return {
		...(stack.createdAtMs !== undefined
			? {
					createdAtMs: stack.createdAtMs,
				}
			: {}),
		itemId: stack.itemId,
		quantity: nextQuantity,
	} satisfies GameSaveInventoryStack;
});

export const readInventorySlotAfterQuantityRemovalFx = Effect.fn(
	"readInventorySlotAfterQuantityRemovalFx",
)(function* ({ quantity, slot }: readInventorySlotAfterQuantityRemovalFx.Props) {
	return yield* match(slot)
		.with(null, () => Effect.succeed(null))
		.with(P.when(isGameSaveInventoryInstance), () => Effect.succeed(null))
		.with(P.when(isGameSaveInventoryStack), (stack) =>
			readRemainingStackAfterQuantityRemovalFx({
				quantity,
				stack,
			}),
		)
		.exhaustive();
});
