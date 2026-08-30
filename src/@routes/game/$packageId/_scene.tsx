import { createFileRoute, Outlet } from "@tanstack/react-router";

import { PlayableGameRoute } from "~/game-shell/ui/PlayableGameRoute";
import { GameShell } from "~/game-shell/ui/GameShell";

/**
 * Lifetime boundary for playable Board and Inventory leaves. Exact-Game audio,
 * cheat admission, menu, Item Detail and renderer providers live here so leaf
 * navigation cannot recreate them or lose in-flight overlay/presentation state.
 * Action and Cheats routes intentionally sit outside this shell.
 */
export const Route = createFileRoute("/game/$packageId/_scene")({
	component: () => (
		<PlayableGameRoute>
			<GameShell>
				<Outlet />
			</GameShell>
		</PlayableGameRoute>
	),
});
