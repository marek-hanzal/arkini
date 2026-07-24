import { getRouteApi } from "@tanstack/react-router";

const gameRouteApi = getRouteApi("/game/$packageId");

/** Reads the exact Game Engine pinned by the active parent route context. */
export const useGameEngine = () =>
	gameRouteApi.useRouteContext({
		select: (context) => context.gameEngine,
	});
