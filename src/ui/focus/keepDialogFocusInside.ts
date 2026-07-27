import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from "react";

export const dialogFocusableSelector = [
	"button:not([disabled])",
	"[href]",
	"input:not([disabled])",
	"select:not([disabled])",
	"textarea:not([disabled])",
	'[tabindex]:not([tabindex="-1"])',
].join(",");

/** Contains an existing keyboard focus cycle inside one mounted dialog. */
export const keepDialogFocusInside = ({
	blockEscape,
	dialogRef,
	event,
}: {
	readonly blockEscape?: boolean;
	readonly dialogRef: RefObject<HTMLDivElement | null>;
	readonly event: ReactKeyboardEvent<HTMLDivElement>;
}) => {
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
};
