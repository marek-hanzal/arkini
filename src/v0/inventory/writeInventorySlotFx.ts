import { Effect } from "effect";
import type { GameSaveInventorySlot } from "~/engine/model/GameSaveSchema";

export namespace writeInventorySlotFx {
	export interface Props {
		slot: GameSaveInventorySlot;
		slotIndex: number;
		slots: GameSaveInventorySlot[];
	}
}

export const writeInventorySlotFx = Effect.fn("writeInventorySlotFx")(function* ({
	slot,
	slotIndex,
	slots,
}: writeInventorySlotFx.Props) {
	slots[slotIndex] = slot;
});
