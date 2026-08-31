import { useCallback, useEffect } from "react";

import { useGameMenuControl } from "~/game-menu/ui/GameMenuProvider";
import { Inventory } from "~/game-shell/ui/Inventory";
import { useItemDetailControl } from "~/item-detail-frame/ui/useItemDetailControl";
import { useInventoryShortcutKey } from "~/game-shell/ui/useInventoryShortcutKey";

/** Shared Inventory leaf with overlay-aware return behavior. */
export const PlayableInventory = ({ onCloseFn }: { readonly onCloseFn: () => void }) => {
	const isInventoryShortcutKeyFn = useInventoryShortcutKey();
	const gameMenu = useGameMenuControl();
	const itemDetail = useItemDetailControl();
	const returnToBoardFn = useCallback(onCloseFn, [
		onCloseFn,
	]);

	useEffect(() => {
		const onKeyDownFn = (event: KeyboardEvent) => {
			if (
				(event.key !== "Escape" && !isInventoryShortcutKeyFn(event)) ||
				event.defaultPrevented ||
				gameMenu.phase !== "closed" ||
				itemDetail.state.phase !== "closed"
			) {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			returnToBoardFn();
		};
		window.addEventListener("keydown", onKeyDownFn, true);
		return () => window.removeEventListener("keydown", onKeyDownFn, true);
	}, [
		gameMenu.phase,
		itemDetail.state.phase,
		returnToBoardFn,
	]);

	return <Inventory onCloseFn={returnToBoardFn} />;
};
