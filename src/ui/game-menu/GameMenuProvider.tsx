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
	const phaseRef = useRef(phase);
	const exitCompletionRef = useRef<ExitCompletion | undefined>(undefined);
	phaseRef.current = phase;

	const open = useCallback(() => {
		if (phaseRef.current !== "closed") return;
		phaseRef.current = "entering";
		setPhase("entering");
	}, []);

	const close = useCallback(() => {
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
			if (phaseRef.current === "exiting") return;
			event.preventDefault();
			toggle();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [
		toggle,
	]);

	useEffect(() => {
		const removeBeforeCloseReady = window.arkini.lifecycle.onBeforeCloseReady?.(() => close());
		return removeBeforeCloseReady;
	}, [
		close,
	]);

	useEffect(
		() => () => {
			exitCompletionRef.current?.resolve();
			exitCompletionRef.current = undefined;
		},
		[],
	);

	const control = useMemo(
		() => ({
			phase,
			isOpen: phase !== "closed",
			open,
			close,
			toggle,
			completeEnter,
			completeExit,
		}),
		[
			close,
			completeEnter,
			completeExit,
			open,
			phase,
			toggle,
		],
	);

	return <GameMenuContext.Provider value={control}>{children}</GameMenuContext.Provider>;
};
