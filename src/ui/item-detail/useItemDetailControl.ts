import { useContext } from "react";

import { ItemDetailContext } from "~/ui/item-detail/ItemDetailContext";

/** Reads the active Canvas-local Item Detail lifecycle. */
export const useItemDetailControl = () => {
	const control = useContext(ItemDetailContext);
	if (control === undefined) {
		throw new Error("Item Detail control is unavailable outside its provider.");
	}
	return control;
};
