import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import { PlayableInventory } from "~/game-shell/ui/PlayableInventory";

export const Route = createFileRoute("/game/$packageId/_scene/inventory")({
	/** The parent scene keeps the exact Game alive; this leaf owns return navigation. */
	component: () => {
		const { packageId } = Route.useParams();
		const navigateFn = useNavigate();
		const onCloseFn = useCallback(() => {
			void navigateFn({
				to: "/game/$packageId/board",
				params: {
					packageId,
				},
				replace: true,
			}).catch((cause) => {
				console.error("Inventory failed to return to the Board.", cause);
			});
		}, [
			navigateFn,
			packageId,
		]);

		return <PlayableInventory onCloseFn={onCloseFn} />;
	},
});
