import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useRef } from "react";

import type { ItemDetailState } from "~/ui/item-detail/ItemDetailControl";

const focusableSelector = [
	"button:not([disabled])",
	"[href]",
	"input:not([disabled])",
	"select:not([disabled])",
	"textarea:not([disabled])",
	'[tabindex]:not([tabindex="-1"])',
].join(",");

const canRestoreFocus = (element: HTMLElement) =>
	element.isConnected &&
	element.matches(focusableSelector) &&
	!element.hidden &&
	element.closest("[inert]") === null &&
	element.style.display !== "none" &&
	element.style.visibility !== "hidden" &&
	element.style.pointerEvents !== "none";

/** Owns Item Detail focus entry, containment, and exact actor restoration. */
export const useItemDetailFocus = ({
	phase,
	origin,
	restoreFocus,
}: {
	readonly phase: Exclude<
		ItemDetailState,
		{
			readonly phase: "closed";
		}
	>["phase"];
	readonly origin: HTMLElement | null;
	readonly restoreFocus: boolean;
}) => {
	const dialogRef = useRef<HTMLDivElement>(null);
	const originRef = useRef(origin);
	const restoreFocusRef = useRef(restoreFocus);
	originRef.current = origin;
	restoreFocusRef.current = restoreFocus;

	useEffect(() => {
		dialogRef.current?.focus();
		return () => {
			if (!restoreFocusRef.current) return;
			const latestOrigin = originRef.current;
			if (latestOrigin !== null && canRestoreFocus(latestOrigin)) {
				latestOrigin.focus();
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
