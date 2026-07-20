import { useEffect } from "react";

import { useGameMenuControl } from "~/ui/game-menu/useGameMenuControl";
import { useItemDetailControl } from "~/ui/item-detail/useItemDetailControl";

/** Disposes Item Detail when the higher-priority game menu takes interaction ownership. */
export const ItemDetailHigherOwnerGuard = () => {
	const gameMenu = useGameMenuControl();
	const itemDetail = useItemDetailControl();

	useEffect(() => {
		if (gameMenu.phase === "closed" || !itemDetail.isOpen) return;
		void itemDetail.close();
	}, [
		gameMenu.phase,
		itemDetail.close,
		itemDetail.isOpen,
	]);

	return null;
};
