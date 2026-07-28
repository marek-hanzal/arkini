import { type PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { GameMenuContext } from "~/ui/game-menu/GameMenuContext";
import {
	type GameMenuAction,
	type GameMenuControl,
	type GameMenuPhase,
} from "~/ui/game-menu/GameMenuControl";

interface GameMenuState {
	readonly phase: GameMenuPhase;
	readonly activeAction: GameMenuAction | null;
}

const initialState = {
	phase: "closed",
	activeAction: null,
} as const satisfies GameMenuState;

/** Owns the mounted Game Menu presentation lifecycle and synchronous UI action claim. */
export const GameMenuProvider = ({ children }: PropsWithChildren) => {
	const stateRef = useRef<GameMenuState>(initialState);
	const [state, setState] = useState<GameMenuState>(initialState);
	const publish = useCallback((next: GameMenuState) => {
		const current = stateRef.current;
		if (current.phase === next.phase && current.activeAction === next.activeAction) return;
		stateRef.current = next;
		setState(next);
	}, []);
	const open = useCallback(() => {
		const current = stateRef.current;
		if (current.activeAction !== null || current.phase !== "closed") return;
		publish({
			...current,
			phase: "entering",
		});
	}, [
		publish,
	]);
	const close = useCallback(() => {
		const current = stateRef.current;
		if (
			current.activeAction !== null ||
			current.phase === "closed" ||
			current.phase === "exiting"
		) {
			return;
		}
		publish({
			...current,
			phase: "exiting",
		});
	}, [
		publish,
	]);
	const toggle = useCallback(() => {
		const current = stateRef.current;
		if (current.activeAction !== null || current.phase === "exiting") return;
		publish({
			...current,
			phase: current.phase === "closed" ? "entering" : "exiting",
		});
	}, [
		publish,
	]);
	const beginAction = useCallback(
		(action: GameMenuAction) => {
			const current = stateRef.current;
			if (current.activeAction !== null || current.phase !== "open") return false;
			publish({
				...current,
				activeAction: action,
			});
			return true;
		},
		[
			publish,
		],
	);
	const completeAction = useCallback(
		(action: GameMenuAction) => {
			const current = stateRef.current;
			if (current.activeAction !== action) return;
			publish({
				...current,
				activeAction: null,
			});
		},
		[
			publish,
		],
	);
	const completeEnter = useCallback(() => {
		const current = stateRef.current;
		if (current.phase !== "entering") return;
		publish({
			...current,
			phase: "open",
		});
	}, [
		publish,
	]);
	const completeExit = useCallback(() => {
		if (stateRef.current.phase !== "exiting") return;
		publish(initialState);
	}, [
		publish,
	]);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape" || event.defaultPrevented) return;
			const current = stateRef.current;
			if (current.activeAction !== null || current.phase === "exiting") {
				event.preventDefault();
				return;
			}
			event.preventDefault();
			toggle();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [
		toggle,
	]);

	const control = useMemo<GameMenuControl>(
		() => ({
			phase: state.phase,
			isOpen: state.phase !== "closed",
			activeAction: state.activeAction,
			routePending:
				state.activeAction === "settings" ||
				state.activeAction === "cheats" ||
				state.activeAction === "main-menu" ||
				state.activeAction === "hard-reset",
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
			state,
			toggle,
		],
	);

	return <GameMenuContext.Provider value={control}>{children}</GameMenuContext.Provider>;
};
