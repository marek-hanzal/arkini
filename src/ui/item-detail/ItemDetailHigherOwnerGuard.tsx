import { useEffect } from "react";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { useGameMenuControl } from "~/ui/game-menu/useGameMenuControl";
import { useItemDetailControl } from "~/ui/item-detail/useItemDetailControl";

/** Disposes Item Detail when the higher-priority game menu takes interaction ownership. */
export const ItemDetailHigherOwnerGuard = () => {
	const gameMenu = useGameMenuControl();
	const itemDetail = useItemDetailControl();

	useEffect(() => {
		if (gameMenu.phase === "closed" || gameMenu.phase === "exiting" || !itemDetail.isOpen) {
			return;
		}
		if (itemDetail.hasPendingActions) {
			void gameMenu.close();
			return;
		}
		void RendererRuntime.runPromise(
			itemDetail.closeFx({
				restoreFocus: false,
			}),
		);
	}, [
		gameMenu.phase,
		itemDetail.closeFx,
		itemDetail.hasPendingActions,
		itemDetail.isOpen,
	]);

	return null;
};
