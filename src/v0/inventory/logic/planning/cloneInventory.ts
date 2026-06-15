import type { InventoryRow } from "~/v0/inventory/model/InventoryRow";

export const cloneInventory = (rows: readonly InventoryRow[]) => {
	return rows.map((row) => ({
		...row,
	}));
};
