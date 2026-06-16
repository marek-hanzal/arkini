import { match } from "ts-pattern";
import { patchInventorySlotCache } from "~/v0/inventory/cache/patchInventorySlotCache";
import type { InventoryView } from "~/v0/inventory/view/InventoryViewSchema";
import type { ActionVisualEventSchema } from "~/v0/play/action/ActionVisualEventSchema";

const emptyStateJson = "{}";

const patchInventoryStackSlot = (
	inventory: InventoryView,
	stackId: string,
	patch: (slot: InventoryView["slots"][number]) => InventoryView["slots"][number],
) => {
	const slot = inventory.slots.find((entry) => entry.stack?.id === stackId);
	if (!slot) return inventory;

	return patchInventorySlotCache({
		inventory,
		slotIndex: slot.slotIndex,
		patch,
	});
};

export const applyInventoryVisualEvent = (
	inventory: InventoryView,
	event: ActionVisualEventSchema.Type,
): InventoryView =>
	match(event)
		.with(
			{
				type: "item.spawned",
			},
			(spawned) => {
				const target = spawned.to;
				if (target.kind !== "inventory") return inventory;

				return patchInventorySlotCache({
					inventory,
					slotIndex: target.slotIndex,
					patch: (slot) => ({
						...slot,
						stack:
							slot.stack?.itemId === spawned.itemId
								? {
										...slot.stack,
										quantity: slot.stack.quantity + 1,
									}
								: {
										id:
											spawned.itemInstanceId ??
											`cache:${spawned.itemId}:${target.slotIndex}`,
										itemId: spawned.itemId,
										quantity: 1,
										state: {},
										stateJson: emptyStateJson,
										stateful: false,
									},
					}),
				});
			},
		)
		.with(
			{
				type: "inventory.stacked",
			},
			(stacked) =>
				patchInventoryStackSlot(inventory, stacked.targetItemInstanceId, (slot) => ({
					...slot,
					stack: slot.stack
						? {
								...slot.stack,
								quantity: stacked.quantity,
							}
						: slot.stack,
				})),
		)
		.otherwise(() => inventory);

export const patchInventoryVisualEvents = (
	inventory: InventoryView,
	events: readonly ActionVisualEventSchema.Type[],
) => events.reduce((current, event) => applyInventoryVisualEvent(current, event), inventory);
