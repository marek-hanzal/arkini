import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import { PlayableBoard } from "~/ui/game/PlayableBoard";

export const Route = createFileRoute("/game/$packageId/_scene/board")({
	/** Composes the installed Board with its package-scoped route navigation. */
	component: () => {
		const { packageId } = Route.useParams();
		const navigate = useNavigate();
		const onOpenInventory = useCallback(
			() =>
				navigate({
					to: "/game/$packageId/inventory",
					params: {
						packageId,
					},
				}).then(() => undefined),
			[
				navigate,
				packageId,
			],
		);

		return <PlayableBoard onOpenInventory={onOpenInventory} />;
	},
});
