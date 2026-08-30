import { useCallback, useEffect, useRef } from "react";
import { match } from "ts-pattern";

import type { GameMenuPhase } from "~/game-menu/type/GameMenuControl";
import { useGameMenuControl } from "~/game-menu/ui/GameMenuProvider";

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

export const gameMenuTransition = {
	duration: 0.5,
	ease: [
		0.22,
		1,
		0.36,
		1,
	] as const,
};

export namespace useGameMenuMotion {
	export interface Props {
		readonly phase: Exclude<GameMenuPhase, "closed">;
	}

	export interface Output {
		readonly backdropOpacity: number;
		readonly completeMotionPhase: () => void;
		readonly dialog: typeof visibleDialog | typeof exitingDialog;
	}
}

/** Settles only the menu phase whose owned animation just completed. */
export const useGameMenuMotion = ({ phase }: useGameMenuMotion.Props): useGameMenuMotion.Output => {
	const menu = useGameMenuControl();
	const completedPhaseRef = useRef<GameMenuPhase | null>(null);

	useEffect(() => {
		completedPhaseRef.current = null;
	}, [
		phase,
	]);

	const completeMotionPhase = useCallback(() => {
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
	}, [
		menu,
		phase,
	]);

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
		backdropOpacity: visual.backdropOpacity,
		completeMotionPhase,
		dialog: visual.dialog,
	};
};
