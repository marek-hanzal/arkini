import { getRouteApi, useLocation } from "@tanstack/react-router";
import { type PropsWithChildren, useSyncExternalStore } from "react";

const gameRouteApi = getRouteApi("/game/$packageId");

/**
 * Delivers the exact mounted Game resource's first background failure to the
 * root router error boundary. Controlled native close remains terminal and
 * must finish even when its best-effort final save reports a failure.
 */
export const GameCriticalFailureBoundary = ({ children }: PropsWithChildren) => {
	const resource = gameRouteApi.useRouteContext({
		select: (context) => context.gameEngineResource,
	});
	const controlledClose = useLocation({
		select: (location) => location.pathname.endsWith("/action/exit"),
	});
	const failure = useSyncExternalStore(
		resource.subscribeCriticalFailureFn,
		resource.getCriticalFailureFn,
		resource.getCriticalFailureFn,
	);
	if (!controlledClose && failure !== null) throw failure;
	return children;
};
