import { isEmptyInventoryStateJson } from "~/inventory/logic/inventoryState";
import type { UpgradeCostDefinition } from "~/manifest/data/upgrade";
import type { InventoryRow } from "./types";

export type InventorySpendPlan =
	| {
			type: "delete";
			stackId: string;
	  }
	| {
			type: "update";
			stackId: string;
			quantity: number;
	  };

export function canSpendInventoryItems(
	rows: readonly InventoryRow[],
	cost: readonly UpgradeCostDefinition[],
) {
	const required = groupQuantity(cost);

	for (const [itemId, quantity] of required) {
		const available = rows
			.filter(
				(row) =>
					row.itemDefinitionId === itemId && isEmptyInventoryStateJson(row.stateJson),
			)
			.reduce((sum, row) => sum + row.quantity, 0);
		if (available < quantity) return false;
	}

	return true;
}

export function spendInventoryItems(
	rows: InventoryRow[],
	cost: readonly UpgradeCostDefinition[],
): InventorySpendPlan[] | null {
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
}

function groupQuantity(cost: readonly UpgradeCostDefinition[]) {
	const grouped = new Map<string, number>();
	for (const entry of cost) {
		grouped.set(entry.itemId, (grouped.get(entry.itemId) ?? 0) + entry.quantity);
	}
	return grouped;
}
