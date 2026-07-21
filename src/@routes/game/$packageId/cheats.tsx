import { createFileRoute, redirect } from "@tanstack/react-router";

import { CheatsPage } from "~/page/cheats/CheatsPage";

export const Route = createFileRoute("/game/$packageId/cheats")({
	beforeLoad: ({ context, params }) => {
		if (context.gameEngine.getSnapshot().cheats.enabled) return;
		throw redirect({
			to: "/game/$packageId/board",
			params,
			replace: true,
		});
	},
	component: CheatsPage,
});
