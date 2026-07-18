import { useMatchRoute, useRouterState } from "@tanstack/react-router";
import type { Effect } from "effect";
import { useLayoutEffect, useRef } from "react";
import type { GameOwner } from "~/bridge/game/GameOwner";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { resolveGameRouteLoadingPresentation } from "~/ui/loading/resolveGameRouteLoadingPresentation";
import { useActionLoading } from "~/ui/loading/useActionLoading";

const runOwnerCommand = (command: Effect.Effect<void, unknown>) => {
	void RendererRuntime.runPromise(command).catch(() => {
		// GameOwner publishes the same authoritative failure for renderer UI.
	});
};

/** Binds one stable GameOwner to the current route and its deliberate loading presentation. */
export const GameOwnerRouteBinding = ({ owner }: { readonly owner: GameOwner }) => {
	const { run: runLoadingAction } = useActionLoading();
	const boundRouteIntentRef = useRef<string | null>(null);
	const pathname = useRouterState({
		select: (routerState) => routerState.location.pathname,
	});
	const matchRoute = useMatchRoute();
	const gameRoute = matchRoute({
		to: "/game/$packageId",
		fuzzy: true,
	});
	const desiredPackageId = gameRoute === false ? null : gameRoute.packageId;

	useLayoutEffect(() => {
		const routeIntent =
			desiredPackageId === null ? `route:${pathname}` : `game:${desiredPackageId}`;
		if (boundRouteIntentRef.current === routeIntent) return;
		boundRouteIntentRef.current = routeIntent;

		const command =
			desiredPackageId === null
				? owner.releaseRouteGameFx()
				: owner.selectPackageFx(desiredPackageId);
		const snapshot = owner.getSnapshot();
		const ownsGame =
			snapshot.type === "ready" || (snapshot.type === "failed" && snapshot.game !== null);
		const presentation = resolveGameRouteLoadingPresentation({
			desiredPackageId,
			ownsGame,
			pathname,
		});

		if (presentation === false) {
			runOwnerCommand(command);
			return;
		}
		void runLoadingAction({
			action: () => RendererRuntime.runPromise(command),
			...presentation,
		}).catch(() => {
			// GameOwner publishes the same authoritative route lifecycle failure.
		});
	}, [
		desiredPackageId,
		owner,
		pathname,
		runLoadingAction,
	]);

	return null;
};
