import { Effect } from "effect";
import { groupSlotsByItemId } from "~/v0/inventory/logic/groupSlotsByItemId";
import { isEmptyInventoryStateJson } from "~/v0/inventory/logic/isEmptyInventoryStateJson";
import { readInventoryState } from "~/v0/inventory/logic/readInventoryState";
import type { ItemId } from "~/v0/manifest/manifestId";
import type { InventorySlot } from "~/v0/inventory/view/InventorySlotSchema";
import { InventoryViewSchema, type InventoryView } from "~/v0/inventory/view/InventoryViewSchema";
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
