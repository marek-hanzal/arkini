import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import { PlayableBoard } from "~/game-shell/ui/PlayableBoard";

export const Route = createFileRoute("/editor/$projectId/board/")({
	component: () => {
		const { projectId } = Route.useParams();
		const navigateFn = useNavigate();
		const onOpenInventoryFn = useCallback(
			() =>
				navigateFn({
					to: "/editor/$projectId/board/inventory",
					params: {
						projectId,
					},
				}).then(() => undefined),
			[
				navigateFn,
				projectId,
			],
		);
		return (
			<PlayableBoard
				cheatAlwaysAvailable
				onOpenInventoryFn={onOpenInventoryFn}
			/>
		);
	},
});
