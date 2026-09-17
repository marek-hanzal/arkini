import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useRef } from "react";

import { overlayFocusableSelector } from "~/ui/constant/overlayFocusableSelector";

/** Owns modal keyboard isolation, focus containment, Escape, and focus return. */
export const useOverlayFocus = ({ onCloseFn }: { readonly onCloseFn: () => void }) => {
	const overlayRef = useRef<HTMLDivElement>(null);
	const previousFocusRef = useRef<HTMLElement | null>(null);

	useEffect(() => {
		previousFocusRef.current =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;
		overlayRef.current?.querySelector<HTMLElement>(overlayFocusableSelector)?.focus();
		return () => {
			const previousFocus = previousFocusRef.current;
			if (previousFocus?.isConnected === true) previousFocus.focus();
		};
	}, []);

	const onKeyDownFn = (event: ReactKeyboardEvent<HTMLDivElement>) => {
		event.stopPropagation();
		// Keep subsequent page shortcuts inside the modal after Tab reaches either edge.
		if (event.key === "Tab") {
			const controls = Array.from(
				event.currentTarget.querySelectorAll<HTMLElement>(overlayFocusableSelector),
			).filter(
				(control) =>
					!control.matches(":disabled") && control.closest("[hidden], [inert]") === null,
			);
			const first = controls[0];
			const last = controls[controls.length - 1];
			if (
				first === undefined ||
				document.activeElement === event.currentTarget ||
				(event.shiftKey
					? document.activeElement === first
					: document.activeElement === last)
			) {
				event.preventDefault();
				(event.shiftKey ? last : first)?.focus();
			}
		}
		if (event.key !== "Escape") return;
		event.preventDefault();
		onCloseFn();
	};

	return {
		overlayRef,
		onKeyDownFn,
	};
};
