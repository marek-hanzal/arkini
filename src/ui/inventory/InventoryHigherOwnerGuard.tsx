import { useEffect } from "react";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { useGameMenuControl } from "~/ui/game-menu/useGameMenuControl";
import { useInventoryControl } from "~/ui/inventory/useInventoryControl";

/** Unmounts Inventory when the higher-priority game menu takes interaction ownership. */
export const InventoryHigherOwnerGuard = () => {
	const gameMenu = useGameMenuControl();
	const inventory = useInventoryControl();

	useEffect(() => {
		if (gameMenu.phase === "closed" || !inventory.isOpen) return;
		RendererRuntime.runSync(
			inventory.closeFx({
				restoreFocus: false,
			}),
		);
	}, [
		gameMenu.phase,
		inventory.closeFx,
		inventory.isOpen,
	]);

	return null;
};
