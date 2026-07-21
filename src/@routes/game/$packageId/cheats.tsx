import { createFileRoute, redirect } from "@tanstack/react-router";

import { CheatsPage } from "~/page/cheats/CheatsPage";

export const Route = createFileRoute("/game/$packageId/cheats")({
	beforeLoad: async ({ context, params }) => {
		await context.cheatAvailability.waitUntilReady();
		if (context.cheatAvailability.getSnapshot()) return;
		throw redirect({
			to: "/game/$packageId/board",
			params,
			replace: true,
		});
	},
	component: CheatsPage,
});
