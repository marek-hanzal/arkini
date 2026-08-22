import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { GamePage } from "~/page/game/GamePage";

export const Route = createFileRoute("/game/$packageId/_scene/board")({
	component: GameBoardRoute,
});

function GameBoardRoute() {
	const { packageId } = Route.useParams();
	const navigate = useNavigate();
	return (
		<GamePage
			onOpenInventory={() =>
				navigate({
					to: "/game/$packageId/inventory",
					params: {
						packageId,
					},
				}).then(() => undefined)
			}
		/>
	);
}
