import type { UpgradeCostDefinition } from "~/manifest/data/upgrade";
import type { PlayerInventoryRow } from "./types";

export type PlayerInventorySpendPlan =
	| {
			type: "delete";
			stackId: string;
	  }
	| {
			type: "update";
			stackId: string;
			quantity: number;
	  };

export function canSpendPlayerInventoryItems(
	rows: readonly PlayerInventoryRow[],
	cost: readonly UpgradeCostDefinition[],
) {
	return cost.every((entry) => {
		const available = rows
			.filter((row) => row.itemDefinitionId === entry.itemId)
			.reduce((sum, row) => sum + row.quantity, 0);
		return available >= entry.quantity;
	});
}

export function spendPlayerInventoryItems(
	rows: PlayerInventoryRow[],
	cost: readonly UpgradeCostDefinition[],
): PlayerInventorySpendPlan[] | null {
	if (!canSpendPlayerInventoryItems(rows, cost)) return null;
	const plan: PlayerInventorySpendPlan[] = [];

	for (const entry of cost) {
		let remaining = entry.quantity;
		const stacks = rows
			.filter((row) => row.itemDefinitionId === entry.itemId)
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
