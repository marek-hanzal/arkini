import { type KeyboardEvent as ReactKeyboardEvent, type RefObject, useEffect, useRef } from "react";

import { dialogFocusableSelector } from "~/ui/focus/dialogFocusableSelector";
import { useDialogFocusContainment } from "~/ui/focus/useDialogFocusContainment";

/** Owns focus entry, containment, Escape, and restoration for a mounted modal dialog. */
export const useDialogFocus = ({
	initialFocusRef,
	onClose,
}: {
	readonly initialFocusRef?: RefObject<HTMLElement | null>;
	readonly onClose: () => void;
}) => {
	const dialogRef = useRef<HTMLDivElement>(null);
	const previousFocusRef = useRef<HTMLElement | null>(null);

	useEffect(() => {
		previousFocusRef.current =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;
		(
			initialFocusRef?.current ??
			dialogRef.current?.querySelector<HTMLElement>(dialogFocusableSelector) ??
			dialogRef.current
		)?.focus();
		return () => {
			const previousFocus = previousFocusRef.current;
			if (previousFocus?.isConnected === true) previousFocus.focus();
		};
	}, [
		initialFocusRef,
	]);

	const keepContainedFocus = useDialogFocusContainment({
		dialogRef,
	});
	const keepFocusInside = (event: ReactKeyboardEvent<HTMLDivElement>) => {
		if (event.key === "Escape") {
			event.preventDefault();
			event.stopPropagation();
			onClose();
			return;
		}
		keepContainedFocus(event);
	};

	return {
		dialogRef,
		keepFocusInside,
	};
};
