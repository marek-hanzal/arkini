import { type PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { GameMenuContext } from "~/ui/game-menu/GameMenuContext";
import type { GameMenuPhase } from "~/ui/game-menu/GameMenuControl";

interface ExitCompletion {
	readonly promise: Promise<void>;
	readonly resolve: () => void;
}

/** Owns one Escape-driven enter/open/exit lifecycle for the active game shell. */
export const GameMenuProvider = ({ children }: PropsWithChildren) => {
	const [phase, setPhase] = useState<GameMenuPhase>("closed");
	const [routePending, setRoutePending] = useState(false);
	const phaseRef = useRef(phase);
	const routePendingRef = useRef(false);
	const exitCompletionRef = useRef<ExitCompletion | undefined>(undefined);
	phaseRef.current = phase;

	const open = useCallback(() => {
		if (routePendingRef.current || phaseRef.current !== "closed") return;
		phaseRef.current = "entering";
		setPhase("entering");
	}, []);

	const close = useCallback(() => {
		if (routePendingRef.current) return Promise.resolve();
		if (phaseRef.current === "closed") return Promise.resolve();
		if (phaseRef.current === "exiting") {
			return exitCompletionRef.current?.promise ?? Promise.resolve();
		}
		let resolveExit: () => void = () => undefined;
		const promise = new Promise<void>((resolve) => {
			resolveExit = resolve;
		});
		exitCompletionRef.current = {
			promise,
			resolve: resolveExit,
		};
		phaseRef.current = "exiting";
		setPhase("exiting");
		return promise;
	}, []);

	const toggle = useCallback(() => {
		if (routePendingRef.current) return;
		if (phaseRef.current === "closed") {
			open();
			return;
		}
		if (phaseRef.current === "entering" || phaseRef.current === "open") {
			void close();
		}
	}, [
		close,
		open,
	]);

	const beginRouteRequest = useCallback(() => {
		if (routePendingRef.current || phaseRef.current !== "open") return false;
		routePendingRef.current = true;
		setRoutePending(true);
		return true;
	}, []);

	const completeRouteRequest = useCallback(() => {
		if (!routePendingRef.current) return;
		routePendingRef.current = false;
		setRoutePending(false);
	}, []);

	const completeEnter = useCallback(() => {
		if (phaseRef.current !== "entering") return;
		phaseRef.current = "open";
		setPhase("open");
	}, []);

	const completeExit = useCallback(() => {
		if (phaseRef.current !== "exiting") return;
		phaseRef.current = "closed";
		setPhase("closed");
		exitCompletionRef.current?.resolve();
		exitCompletionRef.current = undefined;
	}, []);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape" || event.defaultPrevented) return;
			if (routePendingRef.current || phaseRef.current === "exiting") {
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

	useEffect(
		() => () => {
			exitCompletionRef.current?.resolve();
			exitCompletionRef.current = undefined;
			routePendingRef.current = false;
		},
		[],
	);

	const control = useMemo(
		() => ({
			phase,
			isOpen: phase !== "closed",
			routePending,
			open,
			close,
			toggle,
			beginRouteRequest,
			completeRouteRequest,
			completeEnter,
			completeExit,
		}),
		[
			beginRouteRequest,
			close,
			completeEnter,
			completeExit,
			completeRouteRequest,
			open,
			phase,
			routePending,
			toggle,
		],
	);

	return <GameMenuContext.Provider value={control}>{children}</GameMenuContext.Provider>;
};
