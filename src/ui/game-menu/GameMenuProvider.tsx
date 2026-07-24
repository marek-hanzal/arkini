import { type PropsWithChildren, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { createGameMenuController } from "~/ui/game-menu/createGameMenuController";
import { GameMenuContext } from "~/ui/game-menu/GameMenuContext";
import type { GameMenuControl } from "~/ui/game-menu/GameMenuControl";

/** Provides the one synchronous external Game Menu lifecycle owner to the active game shell. */
export const GameMenuProvider = ({ children }: PropsWithChildren) => {
	const [controller] = useState(createGameMenuController);
	const snapshot = useSyncExternalStore(
		controller.subscribe,
		controller.getSnapshot,
		controller.getSnapshot,
	);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape" || event.defaultPrevented) return;
			const current = controller.getSnapshot();
			if (current.routePending || current.phase === "exiting") {
				event.preventDefault();
				return;
			}
			event.preventDefault();
			controller.toggle();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [
		controller,
	]);

	useEffect(
		() => () => {
			controller.reset();
		},
		[
			controller,
		],
	);

	const control = useMemo<GameMenuControl>(
		() => ({
			phase: snapshot.phase,
			isOpen: snapshot.phase !== "closed",
			routePending: snapshot.routePending,
			open: controller.open,
			close: controller.close,
			toggle: controller.toggle,
			beginRouteRequest: controller.beginRouteRequest,
			completeRouteRequest: controller.completeRouteRequest,
			completeEnter: controller.completeEnter,
			completeExit: controller.completeExit,
		}),
		[
			controller,
			snapshot,
		],
	);

	return <GameMenuContext.Provider value={control}>{children}</GameMenuContext.Provider>;
};
