import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useRef } from "react";

import { overlayFocusableSelector } from "~/ui/constant/overlayFocusableSelector";

/** Owns first-control focus, Escape, and focus return for one mounted overlay. */
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
		if (event.key !== "Escape") return;
		event.preventDefault();
		event.stopPropagation();
		onCloseFn();
	};

	return {
		overlayRef,
		onKeyDownFn,
	};
};
