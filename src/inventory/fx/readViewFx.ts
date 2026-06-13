import { Effect } from "effect";
import { db } from "~/database/local/db";
import { groupSlotsByItemId } from "~/inventory/logic/groupSlotsByItemId";
import { table } from "~/database/local/tables";
import type { InventorySlot, InventoryView } from "~/play/logic/playTypes";
import { defaultSaveGameId } from "~/play/logic/save";
import { readSaveFx } from "~/play/fx/readSaveFx";
import { tryGameAction } from "~/play/logic/tryGameAction";

export const readViewFx = Effect.fn("readViewFx")(function* () {
	const save = yield* readSaveFx();
	const rows = yield* tryGameAction(() =>
		db
			.selectFrom(table.inventoryStack)
			.selectAll()
			.where("saveGameId", "=", defaultSaveGameId)
			.orderBy("slotIndex")
			.execute(),
	);

	const stackBySlotIndex = new Map(
		rows.map((stack) => [
			stack.slotIndex,
			stack,
		]),
	);
	const slots = Array.from(
		{
			length: save.inventorySlots,
		},
		(_, slotIndex): InventorySlot => {
			const stack = stackBySlotIndex.get(slotIndex);
			return {
				slotIndex,
				stack: stack
					? {
							id: stack.id,
							itemId: stack.itemDefinitionId,
							quantity: stack.quantity,
						}
					: undefined,
			};
		},
	);

	return {
		slots,
		bySlotIndex: Object.fromEntries(
			slots.map((slot) => [
				slot.slotIndex,
				slot,
			]),
		),
		stacksByItemId: groupSlotsByItemId(slots),
		firstEmptySlotIndex: slots.find((slot) => !slot.stack)?.slotIndex,
	} satisfies InventoryView;
});
