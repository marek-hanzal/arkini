import { type KeyboardEvent as ReactKeyboardEvent, type RefObject, useCallback } from "react";

import { dialogFocusableSelector } from "~/ui/focus/dialogFocusableSelector";

/** Contains an existing keyboard focus cycle inside one mounted dialog. */
export const useDialogFocusContainment = ({
	blockEscape,
	dialogRef,
}: {
	readonly blockEscape?: boolean;
	readonly dialogRef: RefObject<HTMLDivElement | null>;
}) =>
	useCallback(
		(event: ReactKeyboardEvent<HTMLDivElement>) => {
			if (event.key === "Escape" && blockEscape === true) {
				event.preventDefault();
				event.stopPropagation();
				return;
			}
			if (event.key !== "Tab") return;
			const controls = Array.from(
				dialogRef.current?.querySelectorAll<HTMLElement>(dialogFocusableSelector) ?? [],
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
		},
		[
			blockEscape,
			dialogRef,
		],
	);
