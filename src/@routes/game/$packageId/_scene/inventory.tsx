import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import { PlayableInventory } from "~/ui/game/PlayableInventory";

export const Route = createFileRoute("/game/$packageId/_scene/inventory")({
	/** The parent scene keeps the exact Game alive; this leaf owns return navigation. */
	component: () => {
		const { packageId } = Route.useParams();
		const navigate = useNavigate();
		const onClose = useCallback(() => {
			void navigate({
				to: "/game/$packageId/board",
				params: {
					packageId,
				},
				replace: true,
			}).catch((cause) => {
				console.error("Inventory failed to return to the Board.", cause);
			});
		}, [
			navigate,
			packageId,
		]);

		return <PlayableInventory onClose={onClose} />;
	},
});
