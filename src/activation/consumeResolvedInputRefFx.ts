import { Effect } from "effect";
import { match } from "ts-pattern";
import type { GameActionResolvedInputRef } from "~/action/GameActionResolvedInputRef";
import { removeBoardItemRuntimeStateFx } from "~/board/logic/removeBoardItemRuntimeStateFx";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameEvent } from "~/event/GameEventSchema";
import {
	isGameSaveInventoryInstance,
	readGameSaveInventorySlotQuantity,
} from "~/inventory/model/GameSaveInventorySlot";
import type { GameSave, GameSaveInventoryStack } from "~/engine/model/GameSaveSchema";

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
			(boardRef) =>
				Effect.gen(function* () {
					delete nextSave.board.items[boardRef.itemInstanceId];
					yield* removeBoardItemRuntimeStateFx({
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
				}),
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
						yield* removeBoardItemRuntimeStateFx({
							itemInstanceId: slot.id,
							save: nextSave,
						});
					} else {
						nextSave.inventory.slots[inventoryRef.slotIndex] =
							nextQuantity === 0
								? null
								: ({
										...(slot.createdAtMs !== undefined
											? {
													createdAtMs: slot.createdAtMs,
												}
											: {}),
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
