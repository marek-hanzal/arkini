import { useEffect } from "react";

import { useGameMenuControl } from "~/ui/game-menu/useGameMenuControl";
import { useInventoryControl } from "~/ui/inventory/useInventoryControl";

/** Unmounts Inventory when the higher-priority game menu takes interaction ownership. */
export const InventoryHigherOwnerGuard = () => {
	const gameMenu = useGameMenuControl();
	const inventory = useInventoryControl();

	useEffect(() => {
		if (gameMenu.phase === "closed" || !inventory.isOpen) return;
		inventory.close({
			restoreFocus: false,
		});
	}, [
		gameMenu.phase,
		inventory.close,
		inventory.isOpen,
	]);

	return null;
};
