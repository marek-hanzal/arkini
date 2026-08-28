import { useEffect, useRef } from "react";

import type { GameMenuPhase } from "~/ui/game-menu/GameMenuControl";
import { dialogFocusableSelector } from "~/ui/focus/dialogFocusableSelector";
import { useDialogFocusContainment } from "~/ui/focus/useDialogFocusContainment";

/** Owns game-menu focus entry, containment, restoration, and blocked Escape handling. */
export const useGameMenuFocus = ({
	phase,
	blocked,
}: {
	readonly phase: Exclude<GameMenuPhase, "closed">;
	readonly blocked: boolean;
}) => {
	const dialogRef = useRef<HTMLDivElement>(null);
	const previousFocusRef = useRef<HTMLElement | null>(null);

	useEffect(() => {
		previousFocusRef.current =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;
		dialogRef.current?.focus();
		return () => {
			const previousFocus = previousFocusRef.current;
			if (previousFocus?.isConnected === true) {
				previousFocus.focus();
				return;
			}
			document.querySelector<HTMLElement>('[data-ui="GameShell"]')?.focus();
		};
	}, []);

	useEffect(() => {
		if (phase !== "open") return;
		dialogRef.current?.querySelector<HTMLElement>(dialogFocusableSelector)?.focus();
	}, [
		phase,
	]);

	const keepFocusInside = useDialogFocusContainment({
		blockEscape: blocked,
		dialogRef,
	});

	return {
		dialogRef,
		keepFocusInside,
	};
};
