import { useContext } from "react";

import { InventoryContext } from "~/ui/inventory/InventoryContext";

/** Reads the active game-shell Inventory control. */
export const useInventoryControl = () => {
	const control = useContext(InventoryContext);
	if (control === undefined) {
		throw new Error("Inventory control is unavailable outside its provider.");
	}
	return control;
};
