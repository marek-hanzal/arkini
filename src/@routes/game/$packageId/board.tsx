import { createFileRoute } from "@tanstack/react-router";
import { GamePage } from "~/page/game/GamePage";
import { PlayableGameRoute } from "~/ui/game/PlayableGameRoute";

const BoardRoute = () => (
	<PlayableGameRoute>
		<GamePage />
	</PlayableGameRoute>
);

export const Route = createFileRoute("/game/$packageId/board")({
	component: BoardRoute,
});
