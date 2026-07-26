import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect } from "react";

import { useGameMenuControl } from "~/ui/game-menu/useGameMenuControl";
import { Inventory } from "~/ui/inventory/Inventory";
import { useItemDetailControl } from "~/ui/item-detail/useItemDetailControl";

/**
 * Owns only Inventory-to-Board navigation; the parent scene route keeps the
 * exact Game and shared overlays alive. Escape respects overlay priority:
 * Item Detail consumes it first, then Game Menu, and only an otherwise
 * unclaimed Escape replaces this leaf with Board.
 */
export const InventoryPage = ({ packageId }: { readonly packageId: string }) => {
	const gameMenu = useGameMenuControl();
	const itemDetail = useItemDetailControl();
	const navigate = useNavigate();
	const returnToBoard = useCallback(() => {
		void navigate({
			to: "/game/$packageId/board",
			params: {
				packageId,
			},
			replace: true,
		}).catch((cause) => {
			console.error("Inventory failed to return to the Board.", cause);
		});
	}, [
		navigate,
		packageId,
	]);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (
				event.key !== "Escape" ||
				event.defaultPrevented ||
				gameMenu.isOpen ||
				itemDetail.isOpen
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
		gameMenu.isOpen,
		itemDetail.isOpen,
		returnToBoard,
	]);

	return <Inventory onClose={returnToBoard} />;
};
