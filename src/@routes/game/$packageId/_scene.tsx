import { createFileRoute, Outlet } from "@tanstack/react-router";

import { PlayableGameRoute } from "~/ui/game/PlayableGameRoute";
import { GameShell } from "~/ui/shell/GameShell";

const GameSceneRoute = () => (
	<PlayableGameRoute>
		<GameShell>
			<Outlet />
		</GameShell>
	</PlayableGameRoute>
);

/** Keeps shared playable-scene owners alive while Board and Inventory leaves alternate. */
export const Route = createFileRoute("/game/$packageId/_scene")({
	component: GameSceneRoute,
});
