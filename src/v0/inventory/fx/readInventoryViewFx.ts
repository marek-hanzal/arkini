import { Effect } from "effect";
import { groupSlotsByItemId } from "~/inventory/logic/groupSlotsByItemId";
import { isEmptyInventoryStateJson } from "~/inventory/logic/isEmptyInventoryStateJson";
import { readInventoryState } from "~/inventory/logic/readInventoryState";
import type { ItemId } from "~/manifest/manifestId";
import type { InventorySlot } from "~/inventory/view/InventorySlotSchema";
import { InventoryViewSchema, type InventoryView } from "~/inventory/view/InventoryViewSchema";
import { readInventoryStackRowsFx } from "~/v0/item-instance/fx/readInventoryStackRowsFx";
import { readSaveFx } from "~/v0/play/fx/readSaveFx";

export const readInventoryViewFx = Effect.fn("readInventoryViewFx")(function* () {
	const save = yield* readSaveFx();
	const rows = yield* readInventoryStackRowsFx();

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
							itemId: stack.itemDefinitionId as ItemId,
							quantity: stack.quantity,
							state: readInventoryState(stack.stateJson),
							stateJson: stack.stateJson,
							stateful: !isEmptyInventoryStateJson(stack.stateJson),
						}
					: undefined,
			};
		},
	);

	return InventoryViewSchema.parse({
		slots,
		bySlotIndex: Object.fromEntries(
			slots.map((slot) => [
				slot.slotIndex,
				slot,
			]),
		),
		stacksByItemId: groupSlotsByItemId(slots),
		firstEmptySlotIndex: slots.find((slot) => !slot.stack)?.slotIndex,
	}) satisfies InventoryView;
});
