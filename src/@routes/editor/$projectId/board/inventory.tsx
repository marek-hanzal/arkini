import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import { useEditorHistoryBack } from "~/ui/editor/useEditorHistoryBack";
import { PlayableInventory } from "~/ui/game/PlayableInventory";

export const Route = createFileRoute("/editor/$projectId/board/inventory")({
	component: () => {
		const { projectId } = Route.useParams();
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
	},
});
