import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import { PlayableBoard } from "~/ui/game/PlayableBoard";

export const Route = createFileRoute("/editor/$projectId/board/")({
	component: () => {
		const { projectId } = Route.useParams();
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
	},
});
