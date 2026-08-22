import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import { PlayableInventory } from "~/ui/game/PlayableInventory";

const inventoryRoute = getRouteApi("/game/$packageId/_scene/inventory");

/**
 * Owns only Inventory-to-Board navigation; the parent scene route keeps the
 * exact Game and shared overlays alive. Escape and the Board's Inventory
 * shortcut return to Board while respecting overlay priority: Item Detail
 * consumes input first, then Game Menu, and only an otherwise unclaimed
 * navigation key replaces this leaf with Board.
 */
export const InventoryPage = () => {
	const { packageId } = inventoryRoute.useParams();
	const navigate = useNavigate();
	const onClose = useCallback(() => {
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

	return <PlayableInventory onClose={onClose} />;
};
