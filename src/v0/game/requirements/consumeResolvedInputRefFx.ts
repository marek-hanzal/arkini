import { Effect } from "effect";
import { match } from "ts-pattern";
import type { GameActionResolvedInputRef } from "~/v0/game/action/GameActionResolvedInputRef";
import { removeBoardItemRuntimeState } from "~/v0/game/board/removeBoardItemRuntimeState";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameEvent } from "~/v0/game/event/GameEventSchema";
import {
	isGameSaveInventoryInstance,
	readGameSaveInventorySlotQuantity,
} from "~/v0/game/inventory/GameSaveInventorySlot";
import type { GameSave, GameSaveInventoryStack } from "~/v0/game/engine/model/GameSaveSchema";

export namespace consumeResolvedInputRefFx {
	export interface Props {
		nextSave: GameSave;
		ref: GameActionResolvedInputRef;
		events: GameEvent[];
		reason: Extract<
			GameEvent,
			{
				type: "item.consumed";
			}
		>["reason"];
	}
}

export const consumeResolvedInputRefFx = Effect.fn("consumeResolvedInputRefFx")(function* ({
	nextSave,
	ref,
	events,
	reason,
}: consumeResolvedInputRefFx.Props) {
	yield* match(ref)
		.with(
			{
				kind: "board",
			},
			(boardRef) => {
				delete nextSave.board.items[boardRef.itemInstanceId];
				removeBoardItemRuntimeState({
					itemInstanceId: boardRef.itemInstanceId,
					save: nextSave,
				});
				events.push({
					from: {
						kind: "board",
						itemInstanceId: boardRef.itemInstanceId,
					},
					itemId: boardRef.itemId,
					reason,
					type: "item.consumed",
				});
				return Effect.void;
			},
		)
		.with(
			{
				kind: "inventory",
			},
			(inventoryRef) =>
				Effect.gen(function* () {
					const slot = nextSave.inventory.slots[inventoryRef.slotIndex];
					if (!slot) {
						return yield* Effect.fail(
							GameEngineError.actionRejected(
								"input_unavailable",
								`Missing inventory input at slot ${inventoryRef.slotIndex}.`,
							),
						);
					}
					const previousQuantity = readGameSaveInventorySlotQuantity(slot);
					const nextQuantity = previousQuantity - inventoryRef.quantity;
					if (nextQuantity < 0) {
						return yield* Effect.fail(
							GameEngineError.actionRejected(
								"input_unavailable",
								`Inventory input at slot ${inventoryRef.slotIndex} is already spent.`,
							),
						);
					}
					if (isGameSaveInventoryInstance(slot)) {
						nextSave.inventory.slots[inventoryRef.slotIndex] = null;
						removeBoardItemRuntimeState({
							itemInstanceId: slot.id,
							save: nextSave,
						});
					} else {
						nextSave.inventory.slots[inventoryRef.slotIndex] =
							nextQuantity === 0
								? null
								: ({
										itemId: slot.itemId,
										quantity: nextQuantity,
									} satisfies GameSaveInventoryStack);
					}
					events.push({
						from: {
							kind: "inventory",
							nextQuantity,
							previousQuantity,
							quantity: inventoryRef.quantity,
							slotIndex: inventoryRef.slotIndex,
						},
						itemId: inventoryRef.itemId,
						reason,
						type: "item.consumed",
					});
				}),
		)
		.exhaustive();
});
