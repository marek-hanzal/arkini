import { useEffect } from "react";

import { useGameMenuControl } from "~/ui/game-menu/useGameMenuControl";
import { useCloseItemDetail } from "~/ui/item-detail/useCloseItemDetail";
import { useItemDetailControl } from "~/ui/item-detail/useItemDetailControl";

/** Disposes Item Detail when the higher-priority game menu takes interaction ownership. */
export const ItemDetailHigherOwnerGuard = () => {
	const gameMenu = useGameMenuControl();
	const itemDetail = useItemDetailControl();
	const closeItemDetail = useCloseItemDetail();

	useEffect(() => {
		if (gameMenu.phase === "closed" || gameMenu.phase === "exiting" || !itemDetail.isOpen) {
			return;
		}
		if (itemDetail.hasPendingActions) {
			void gameMenu.close();
			return;
		}
		closeItemDetail({
			restoreFocus: false,
		});
	}, [
		closeItemDetail,
		gameMenu.phase,
		itemDetail.hasPendingActions,
		itemDetail.isOpen,
	]);

	return null;
};
