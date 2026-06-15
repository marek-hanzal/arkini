import { isEmptyInventoryStateJson } from "~/v0/inventory/logic/isEmptyInventoryStateJson";
import type { UpgradeCostDefinition } from "~/v0/manifest/upgrade/UpgradeCostDefinition";
import { canSpendInventoryItems } from "./canSpendInventoryItems";
import { groupQuantity } from "./groupQuantity";
import type { InventorySpendPlan } from "./InventorySpendPlan";
import type { InventoryRow } from "~/v0/inventory/model/InventoryRow";

export const spendInventoryItems = (
	rows: InventoryRow[],
	cost: readonly UpgradeCostDefinition[],
): InventorySpendPlan[] | null => {
	if (!canSpendInventoryItems(rows, cost)) return null;
	const plan: InventorySpendPlan[] = [];

	for (const entry of groupQuantity(cost).entries()) {
		const [itemId, quantity] = entry;
		let remaining = quantity;
		const stacks = rows
			.filter(
				(row) =>
					row.itemDefinitionId === itemId && isEmptyInventoryStateJson(row.stateJson),
			)
			.sort((left, right) => left.slotIndex - right.slotIndex);

		for (const stack of stacks) {
			const spend = Math.min(stack.quantity, remaining);
			stack.quantity -= spend;
			remaining -= spend;

			if (stack.quantity <= 0) {
				plan.push({
					type: "delete",
					stackId: stack.id,
				});
				const index = rows.findIndex((row) => row.id === stack.id);
				if (index >= 0) rows.splice(index, 1);
			} else {
				plan.push({
					type: "update",
					stackId: stack.id,
					quantity: stack.quantity,
				});
			}

			if (remaining <= 0) break;
		}
	}

	return plan;
};
