import type { QueryClient } from "@tanstack/react-query";

import { waitForGameEngineResource } from "~/bridge/game/waitForGameEngineResource";
import type { ArkiniRouter } from "~/router";
import { waitForActionLoadingCompletionFrame } from "~/ui/loading/waitForActionLoadingCompletionFrame";

export namespace installRendererControlledClose {
	export interface Props {
		readonly lifecycle: Pick<
			Window["arkini"]["lifecycle"],
			"onBeforeClose" | "onBeforeCloseReady"
		>;
		readonly queryClient: QueryClient;
		readonly router: Pick<ArkiniRouter, "navigate">;
	}
}

/** Sends active-game native close through the terminal route and its completed Hero frame. */
export const installRendererControlledClose = ({
	lifecycle,
	queryClient,
	router,
}: installRendererControlledClose.Props): (() => void) => {
	let exitPresentationRequired = false;

	const removeBeforeClose = lifecycle.onBeforeClose(async () => {
		exitPresentationRequired = false;
		const resource = await waitForGameEngineResource(queryClient);
		if (resource === null) return;
		exitPresentationRequired = true;
		await router.navigate({
			to: "/game/$packageId/action/exit",
			params: {
				packageId: resource.game.arkpack.packageId,
			},
			replace: true,
		});
	});
	const removeBeforeCloseReady = lifecycle.onBeforeCloseReady(async () => {
		if (!exitPresentationRequired) return;
		await waitForActionLoadingCompletionFrame();
	});

	return () => {
		removeBeforeClose();
		removeBeforeCloseReady();
	};
};
