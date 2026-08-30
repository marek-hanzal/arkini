import {
	createContext,
	type PropsWithChildren,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import {
	type GameMenuAction,
	type GameMenuControl,
	type GameMenuPhase,
} from "~/game-menu/type/GameMenuControl";

interface GameMenuState {
	readonly phase: GameMenuPhase;
	readonly activeAction: GameMenuAction | null;
}

const initialState = {
	phase: "closed",
	activeAction: null,
} as const satisfies GameMenuState;

/** Game-only menu state. It exists only while the active game shell is mounted. */
const GameMenuContext = createContext<GameMenuControl | undefined>(undefined);

/** Reads the active game menu control from the game-shell boundary. */
export const useGameMenuControl = () => {
	const control = useContext(GameMenuContext);
	if (control === undefined) {
		throw new Error("Game menu control is unavailable outside its provider.");
	}
	return control;
};

/** Owns the mounted Game Menu presentation lifecycle and synchronous UI action claim. */
export const GameMenuProvider = ({
	children,
	keyboardEnabled = true,
}: PropsWithChildren<{
	readonly keyboardEnabled?: boolean;
}>) => {
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
		if (!keyboardEnabled) return;
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
		keyboardEnabled,
		toggle,
	]);

	const control = useMemo<GameMenuControl>(
		() => ({
			phase: state.phase,
			activeAction: state.activeAction,
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
