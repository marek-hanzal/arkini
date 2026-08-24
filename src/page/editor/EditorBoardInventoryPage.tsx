import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import { PlayableInventory } from "~/ui/game/PlayableInventory";

const inventoryRoute = getRouteApi("/editor/$projectId/board/inventory");

export const EditorBoardInventoryPage = () => {
	const { projectId } = inventoryRoute.useParams();
	const navigate = useNavigate();
	const onClose = useCallback(() => {
		void navigate({
			to: "/editor/$projectId/board",
			params: {
				projectId,
			},
			replace: true,
		}).catch((cause) => {
			console.error("Editor Inventory failed to return to the Board.", cause);
		});
	}, [
		navigate,
		projectId,
	]);
	return <PlayableInventory onClose={onClose} />;
};
