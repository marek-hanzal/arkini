import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import { PlayableBoard } from "~/ui/game/PlayableBoard";

const boardRoute = getRouteApi("/editor/$projectId/board/");

export const EditorBoardPlayablePage = () => {
	const { projectId } = boardRoute.useParams();
	const navigate = useNavigate();
	const onOpenInventory = useCallback(
		() =>
			navigate({
				to: "/editor/$projectId/board/inventory",
				params: {
					projectId,
				},
			}).then(() => undefined),
		[
			navigate,
			projectId,
		],
	);
	return (
		<PlayableBoard
			cheatAlwaysAvailable
			onOpenInventory={onOpenInventory}
		/>
	);
};
