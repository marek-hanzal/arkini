import type { InventoryRow } from "./types";

export const cloneInventory = (rows: readonly InventoryRow[]) => {
	return rows.map((row) => ({
		...row,
	}));
};
