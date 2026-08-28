import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import { PlayableInventory } from "~/ui/game/PlayableInventory";
import { useEditorHistoryBack } from "~/ui/editor/useEditorHistoryBack";

const inventoryRoute = getRouteApi("/editor/$projectId/board/inventory");

export const EditorBoardInventoryPage = () => {
	const { projectId } = inventoryRoute.useParams();
	const navigate = useNavigate();
	const returnToBoard = useCallback(() => {
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
	const historyBack = useEditorHistoryBack();
	const onClose = useCallback(
		() => historyBack(returnToBoard),
		[
			historyBack,
			returnToBoard,
		],
	);
	return <PlayableInventory onClose={onClose} />;
};
