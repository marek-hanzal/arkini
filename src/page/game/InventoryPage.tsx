import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect } from "react";

import { useGameMenuControl } from "~/ui/game-menu/useGameMenuControl";
import { Inventory } from "~/ui/inventory/Inventory";
import { useItemDetailControl } from "~/ui/item-detail/useItemDetailControl";

/** Owns deterministic Inventory return navigation while the parent keeps the Game alive. */
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
