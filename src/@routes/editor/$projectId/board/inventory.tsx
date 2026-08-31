import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import { useEditorHistoryBack } from "~/authoring-shell/ui/useEditorHistoryBack";
import { PlayableInventory } from "~/game-shell/ui/PlayableInventory";

export const Route = createFileRoute("/editor/$projectId/board/inventory")({
	component: () => {
		const { projectId } = Route.useParams();
		const navigateFn = useNavigate();
		const returnToBoardFn = useCallback(() => {
			void navigateFn({
				to: "/editor/$projectId/board",
				params: {
					projectId,
				},
				replace: true,
			}).catch((cause) => {
				console.error("Editor Inventory failed to return to the Board.", cause);
			});
		}, [
			navigateFn,
			projectId,
		]);
		const historyBackFn = useEditorHistoryBack();
		const onCloseFn = useCallback(
			() => historyBackFn(returnToBoardFn),
			[
				historyBackFn,
				returnToBoardFn,
			],
		);
		return <PlayableInventory onCloseFn={onCloseFn} />;
	},
});
