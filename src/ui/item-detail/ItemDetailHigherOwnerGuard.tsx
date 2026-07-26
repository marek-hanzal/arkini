import { useEffect } from "react";

import { useGameMenuControl } from "~/ui/game-menu/useGameMenuControl";
import { useCloseItemDetail } from "~/ui/item-detail/useCloseItemDetail";
import { useItemDetailControl } from "~/ui/item-detail/useItemDetailControl";

/**
 * Enforces the overlay ownership order: Game Menu may replace idle Item Detail,
 * but it must yield when Detail has an admitted command that pins its target.
 * Focus restoration is suppressed during handoff so the hidden scene cannot
 * steal focus from the incoming higher owner.
 */
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
