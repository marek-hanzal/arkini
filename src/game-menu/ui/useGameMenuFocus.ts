import { type RefObject, useEffect, useRef } from "react";

import type { GameMenuPhase } from "~/game-menu/type/GameMenuControl";
import { overlayFocusableSelector } from "~/ui/focus/overlayFocusableSelector";

export namespace useGameMenuFocus {
	export interface Props {
		readonly phase: Exclude<GameMenuPhase, "closed">;
	}

	export interface Output {
		readonly overlayRef: RefObject<HTMLDivElement | null>;
	}
}

/** Owns the deliberate menu focus handoff and return lifecycle. */
export const useGameMenuFocus = ({ phase }: useGameMenuFocus.Props): useGameMenuFocus.Output => {
	const overlayRef = useRef<HTMLDivElement>(null);
	const previousFocusRef = useRef<HTMLElement | null>(null);

	useEffect(() => {
		previousFocusRef.current =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;
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
		overlayRef.current?.querySelector<HTMLElement>(overlayFocusableSelector)?.focus();
	}, [
		phase,
	]);

	return {
		overlayRef,
	};
};
