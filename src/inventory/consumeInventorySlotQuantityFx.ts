import { Effect } from "effect";
import { removeBoardItemRuntimeStateFx } from "~/board/removeBoardItemRuntimeStateFx";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSave, GameSaveInventorySlot } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import { createInventoryItemConsumedEventFx } from "~/inventory/createInventoryItemConsumedEventFx";
import {
	isGameSaveInventoryInstance,
	readGameSaveInventorySlotQuantity,
} from "~/inventory/model/GameSaveInventorySlot";
import { readInventorySlotAfterQuantityRemovalFx } from "~/inventory/readInventorySlotAfterQuantityRemovalFx";

export namespace consumeInventorySlotQuantityFx {
	export interface Props {
		nextSave: GameSave;
		quantity: number;
		reason: Extract<
			GameEvent,
			{
				type: "item.consumed";
			}
		>["reason"];
		runtimeState: "preserve-instance" | "remove-instance";
		slotIndex: number;
	}

	export interface Result {
		consumedEvent: Extract<
			GameEvent,
			{
				type: "item.consumed";
			}
		>;
		itemId: string;
		nextQuantity: number;
		previousQuantity: number;
		slot: Exclude<GameSaveInventorySlot, null>;
	}
}

export const consumeInventorySlotQuantityFx = Effect.fn("consumeInventorySlotQuantityFx")(
	function* ({
		nextSave,
		quantity,
		reason,
		runtimeState,
		slotIndex,
	}: consumeInventorySlotQuantityFx.Props) {
		const slot = nextSave.inventory.slots[slotIndex];
		if (!slot) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"input_unavailable",
					`Missing inventory input at slot ${slotIndex}.`,
				),
			);
		}

		const previousQuantity = readGameSaveInventorySlotQuantity(slot);
		const nextQuantity = previousQuantity - quantity;
		if (nextQuantity < 0) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"input_unavailable",
					`Inventory input at slot ${slotIndex} is already spent.`,
				),
			);
		}

		nextSave.inventory.slots[slotIndex] = yield* readInventorySlotAfterQuantityRemovalFx({
			quantity,
			slot,
		});
		if (runtimeState === "remove-instance" && isGameSaveInventoryInstance(slot)) {
			yield* removeBoardItemRuntimeStateFx({
				itemInstanceId: slot.id,
				save: nextSave,
			});
		}

		return {
			consumedEvent: yield* createInventoryItemConsumedEventFx({
				itemId: slot.itemId,
				nextQuantity,
				previousQuantity,
				quantity,
				reason,
				slotIndex,
			}),
			itemId: slot.itemId,
			nextQuantity,
			previousQuantity,
			slot,
		} satisfies consumeInventorySlotQuantityFx.Result;
	},
);
