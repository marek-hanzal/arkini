import { useEffect } from "react";

import { useGameMenuControl } from "~/ui/game-menu/useGameMenuControl";
import { useCloseItemDetail } from "~/ui/item-detail/useCloseItemDetail";
import { useItemDetailControl } from "~/ui/item-detail/useItemDetailControl";

/**
 * Enforces the overlay ownership order without coupling it to gameplay command
 * settlement. Focus restoration is suppressed during handoff so the hidden
 * scene cannot steal focus from the incoming higher owner.
 */
export const ItemDetailHigherOwnerGuard = () => {
	const gameMenu = useGameMenuControl();
	const itemDetail = useItemDetailControl();
	const closeItemDetail = useCloseItemDetail();

	useEffect(() => {
		if (
			gameMenu.phase === "closed" ||
			gameMenu.phase === "exiting" ||
			itemDetail.state.phase === "closed"
		) {
			return;
		}
		closeItemDetail({
			restoreFocus: false,
		});
	}, [
		closeItemDetail,
		gameMenu.phase,
		itemDetail.state.phase,
	]);

	return null;
};
