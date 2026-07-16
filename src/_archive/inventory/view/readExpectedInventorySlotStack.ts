import type { InventorySlot } from "~/inventory/view/InventorySlotSchema";
import type { InventoryView } from "~/inventory/view/InventoryViewSchema";

export type ExpectedInventorySlotStack = NonNullable<InventorySlot["stack"]>;

export namespace readExpectedInventorySlotStack {
	export interface Props {
		expectedItemId: string;
		expectedStackId: string;
		inventory: InventoryView;
		slotIndex: number;
	}
}

export const readExpectedInventorySlotStack = ({
	expectedItemId,
	expectedStackId,
	inventory,
	slotIndex,
}: readExpectedInventorySlotStack.Props): ExpectedInventorySlotStack | undefined => {
	const stack = inventory.bySlotIndex[String(slotIndex)]?.stack;
	if (!stack || stack.id !== expectedStackId || stack.itemId !== expectedItemId) return undefined;

	return stack;
};
