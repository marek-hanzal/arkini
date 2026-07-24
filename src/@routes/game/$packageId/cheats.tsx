import { createFileRoute, redirect } from "@tanstack/react-router";

import { readCheatAvailabilitySnapshotFx } from "~/bridge/cheat/readCheatAvailabilitySnapshotFx";
import { waitForCheatAvailabilityReadyFx } from "~/bridge/cheat/waitForCheatAvailabilityReadyFx";
import { CheatsPage } from "~/page/cheats/CheatsPage";
import { PlayableGameRoute } from "~/ui/game/PlayableGameRoute";

const CheatsRoute = () => (
	<PlayableGameRoute>
		<CheatsPage />
	</PlayableGameRoute>
);

export const Route = createFileRoute("/game/$packageId/cheats")({
	beforeLoad: async ({ context, params }) => {
		await context.rendererRuntime.runPromise(waitForCheatAvailabilityReadyFx());
		if (context.rendererRuntime.runSync(readCheatAvailabilitySnapshotFx())) return;
		throw redirect({
			to: "/game/$packageId/board",
			params,
			replace: true,
		});
	},
	component: CheatsRoute,
});
