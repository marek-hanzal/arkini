import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import { PlayableBoard } from "~/game-shell/ui/PlayableBoard";

export const Route = createFileRoute("/game/$packageId/_scene/board")({
	/** Composes the installed Board with its package-scoped route navigation. */
	component: () => {
		const { packageId } = Route.useParams();
		const navigateFn = useNavigate();
		const onOpenInventoryFn = useCallback(
			() =>
				navigateFn({
					to: "/game/$packageId/inventory",
					params: {
						packageId,
					},
				}).then(() => undefined),
			[
				navigateFn,
				packageId,
			],
		);

		return <PlayableBoard onOpenInventoryFn={onOpenInventoryFn} />;
	},
});
