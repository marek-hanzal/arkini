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
	const [state, setStateFn] = useState<GameMenuState>(initialState);
	const publishFn = useCallback((next: GameMenuState) => {
		const current = stateRef.current;
		if (current.phase === next.phase && current.activeAction === next.activeAction) return;
		stateRef.current = next;
		setStateFn(next);
	}, []);
	const openFn = useCallback(() => {
		const current = stateRef.current;
		if (current.activeAction !== null || current.phase !== "closed") return;
		publishFn({
			...current,
			phase: "entering",
		});
	}, [
		publishFn,
	]);
	const closeFn = useCallback(() => {
		const current = stateRef.current;
		if (
			current.activeAction !== null ||
			current.phase === "closed" ||
			current.phase === "exiting"
		) {
			return;
		}
		publishFn({
			...current,
			phase: "exiting",
		});
	}, [
		publishFn,
	]);
	const toggleFn = useCallback(() => {
		const current = stateRef.current;
		if (current.activeAction !== null || current.phase === "exiting") return;
		publishFn({
			...current,
			phase: current.phase === "closed" ? "entering" : "exiting",
		});
	}, [
		publishFn,
	]);
	const beginActionFn = useCallback(
		(action: GameMenuAction) => {
			const current = stateRef.current;
			if (current.activeAction !== null || current.phase !== "open") return false;
			publishFn({
				...current,
				activeAction: action,
			});
			return true;
		},
		[
			publishFn,
		],
	);
	const completeActionFn = useCallback(
		(action: GameMenuAction) => {
			const current = stateRef.current;
			if (current.activeAction !== action) return;
			publishFn({
				...current,
				activeAction: null,
			});
		},
		[
			publishFn,
		],
	);
	const completeEnterFn = useCallback(() => {
		const current = stateRef.current;
		if (current.phase !== "entering") return;
		publishFn({
			...current,
			phase: "open",
		});
	}, [
		publishFn,
	]);
	const completeExitFn = useCallback(() => {
		if (stateRef.current.phase !== "exiting") return;
		publishFn(initialState);
	}, [
		publishFn,
	]);

	useEffect(() => {
		if (!keyboardEnabled) return;
		const onKeyDownFn = (event: KeyboardEvent) => {
			if (event.key !== "Escape" || event.defaultPrevented) return;
			const current = stateRef.current;
			if (current.activeAction !== null || current.phase === "exiting") {
				event.preventDefault();
				return;
			}
			event.preventDefault();
			toggleFn();
		};
		window.addEventListener("keydown", onKeyDownFn);
		return () => window.removeEventListener("keydown", onKeyDownFn);
	}, [
		keyboardEnabled,
		toggleFn,
	]);

	const control = useMemo<GameMenuControl>(
		() => ({
			phase: state.phase,
			activeAction: state.activeAction,
			openFn,
			closeFn,
			toggleFn,
			beginActionFn,
			completeActionFn,
			completeEnterFn,
			completeExitFn,
		}),
		[
			beginActionFn,
			closeFn,
			completeActionFn,
			completeEnterFn,
			completeExitFn,
			openFn,
			state,
			toggleFn,
		],
	);

	return <GameMenuContext.Provider value={control}>{children}</GameMenuContext.Provider>;
};
