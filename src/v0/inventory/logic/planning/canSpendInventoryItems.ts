import { isEmptyInventoryStateJson } from "~/v0/inventory/logic/isEmptyInventoryStateJson";
import type { UpgradeCostDefinition } from "~/v0/manifest/upgrade";
import { groupQuantity } from "./groupQuantity";
import type { InventoryRow } from "./types";

export const canSpendInventoryItems = (
	rows: readonly InventoryRow[],
	cost: readonly UpgradeCostDefinition[],
) => {
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
};
