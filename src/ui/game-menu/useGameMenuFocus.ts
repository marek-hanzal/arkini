import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useRef } from "react";

import type { GameMenuPhase } from "~/ui/game-menu/GameMenuControl";

const focusableSelector = [
	"button:not([disabled])",
	"[href]",
	"input:not([disabled])",
	"select:not([disabled])",
	"textarea:not([disabled])",
	'[tabindex]:not([tabindex="-1"])',
].join(",");

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
		dialogRef.current?.querySelector<HTMLElement>(focusableSelector)?.focus();
	}, [
		phase,
	]);

	const keepFocusInside = (event: ReactKeyboardEvent<HTMLDivElement>) => {
		if (event.key === "Escape" && blocked) {
			event.preventDefault();
			event.stopPropagation();
			return;
		}
		if (event.key !== "Tab") return;
		const controls = Array.from(
			dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
		);
		if (controls.length === 0) {
			event.preventDefault();
			dialogRef.current?.focus();
			return;
		}
		const first = controls[0];
		const last = controls.at(-1);
		if (first === undefined || last === undefined) return;
		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
			return;
		}
		if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	};

	return {
		dialogRef,
		keepFocusInside,
	};
};
