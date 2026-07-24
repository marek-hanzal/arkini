import {
	type PropsWithChildren,
	useCallback,
	useEffect,
	useMemo,
	useState,
	useSyncExternalStore,
} from "react";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { createGameMenuControllerFx } from "~/ui/game-menu/createGameMenuControllerFx";
import { GameMenuContext } from "~/ui/game-menu/GameMenuContext";
import { type GameMenuAction, type GameMenuControl } from "~/ui/game-menu/GameMenuControl";

/** Provides the one synchronous external Game Menu lifecycle owner to the active game shell. */
export const GameMenuProvider = ({ children }: PropsWithChildren) => {
	const [controller] = useState(() => RendererRuntime.runSync(createGameMenuControllerFx()));
	const snapshot = useSyncExternalStore(
		controller.subscribe,
		controller.getSnapshot,
		controller.getSnapshot,
	);
	const open = useCallback(
		() => RendererRuntime.runSync(controller.openFx),
		[
			controller,
		],
	);
	const close = useCallback(
		() => RendererRuntime.runPromise(controller.closeFx()),
		[
			controller,
		],
	);
	const toggle = useCallback(() => {
		void RendererRuntime.runFork(controller.toggleFx);
	}, [
		controller,
	]);
	const beginAction = useCallback(
		(action: GameMenuAction) => RendererRuntime.runSync(controller.beginActionFx(action)),
		[
			controller,
		],
	);
	const completeAction = useCallback(
		(action: GameMenuAction) => RendererRuntime.runSync(controller.completeActionFx(action)),
		[
			controller,
		],
	);
	const completeEnter = useCallback(
		() => RendererRuntime.runSync(controller.completeEnterFx),
		[
			controller,
		],
	);
	const completeExit = useCallback(
		() => RendererRuntime.runSync(controller.completeExitFx),
		[
			controller,
		],
	);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape" || event.defaultPrevented) return;
			const current = controller.getSnapshot();
			if (current.activeAction !== null || current.phase === "exiting") {
				event.preventDefault();
				return;
			}
			event.preventDefault();
			void RendererRuntime.runFork(controller.toggleFx);
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [
		controller,
	]);

	useEffect(
		() => () => {
			RendererRuntime.runSync(controller.resetFx);
		},
		[
			controller,
		],
	);

	const control = useMemo<GameMenuControl>(
		() => ({
			phase: snapshot.phase,
			isOpen: snapshot.phase !== "closed",
			activeAction: snapshot.activeAction,
			routePending:
				snapshot.activeAction === "settings" ||
				snapshot.activeAction === "cheats" ||
				snapshot.activeAction === "main-menu" ||
				snapshot.activeAction === "hard-reset",
			open,
			close,
			toggle,
			beginAction,
			completeAction,
			completeEnter,
			completeExit,
		}),
		[
			beginAction,
			close,
			completeAction,
			completeEnter,
			completeExit,
			open,
			snapshot,
			toggle,
		],
	);

	return <GameMenuContext.Provider value={control}>{children}</GameMenuContext.Provider>;
};
