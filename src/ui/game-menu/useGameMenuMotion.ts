import { useEffect, useRef } from "react";
import { match } from "ts-pattern";

import type { GameMenuPhase } from "~/ui/game-menu/GameMenuControl";
import { useGameMenuControl } from "~/ui/game-menu/useGameMenuControl";

const visibleDialog = {
	opacity: 1,
	scale: 1,
	y: 0,
	filter: "blur(0px)",
};

const exitingDialog = {
	opacity: 0,
	scale: 0.985,
	y: 6,
	filter: "blur(5px)",
};

/** Owns GameMenu Motion targets and generation-safe phase completion. */
export const useGameMenuMotion = (phase: Exclude<GameMenuPhase, "closed">) => {
	const menu = useGameMenuControl();
	const completedPhaseRef = useRef<GameMenuPhase | null>(null);

	useEffect(() => {
		completedPhaseRef.current = null;
	}, [
		phase,
	]);

	const completeMotionPhase = () => {
		if (completedPhaseRef.current === phase) return;
		match(phase)
			.with("entering", () => {
				completedPhaseRef.current = phase;
				menu.completeEnter();
			})
			.with("open", () => undefined)
			.with("exiting", () => {
				completedPhaseRef.current = phase;
				menu.completeExit();
			})
			.exhaustive();
	};

	const visual = match(phase)
		.with("entering", "open", () => ({
			backdropOpacity: 1,
			dialog: visibleDialog,
		}))
		.with("exiting", () => ({
			backdropOpacity: 0,
			dialog: exitingDialog,
		}))
		.exhaustive();

	return {
		...visual,
		completeMotionPhase,
	};
};
