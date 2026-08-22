import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import { PlayableBoard } from "~/ui/game/PlayableBoard";

const boardRoute = getRouteApi("/game/$packageId/_scene/board");

/** Composes the installed Board with its package-scoped route navigation. */
export function GamePage() {
	const { packageId } = boardRoute.useParams();
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
}
