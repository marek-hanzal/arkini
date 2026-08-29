import { useCallback, useEffect } from "react";

import { useGameMenuControl } from "~/ui/game-menu/useGameMenuControl";
import { Inventory } from "~/ui/inventory/Inventory";
import { useItemDetailControl } from "~/item-detail-frame/useItemDetailControl";
import { useInventoryShortcutKey } from "~/ui/navigation/useInventoryShortcutKey";

/** Shared Inventory leaf with overlay-aware return behavior. */
export const PlayableInventory = ({ onClose }: { readonly onClose: () => void }) => {
	const isInventoryShortcutKey = useInventoryShortcutKey();
	const gameMenu = useGameMenuControl();
	const itemDetail = useItemDetailControl();
	const returnToBoard = useCallback(onClose, [
		onClose,
	]);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (
				(event.key !== "Escape" && !isInventoryShortcutKey(event)) ||
				event.defaultPrevented ||
				gameMenu.phase !== "closed" ||
				itemDetail.state.phase !== "closed"
			) {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			returnToBoard();
		};
		window.addEventListener("keydown", onKeyDown, true);
		return () => window.removeEventListener("keydown", onKeyDown, true);
	}, [
		gameMenu.phase,
		itemDetail.state.phase,
		returnToBoard,
	]);

	return <Inventory onClose={returnToBoard} />;
};
