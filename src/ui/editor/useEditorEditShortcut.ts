import { useEffect, useRef } from "react";

const isEditingText = (target: EventTarget | null) =>
	target instanceof HTMLElement &&
	(target.matches("input, textarea, select") ||
		target.closest('[contenteditable]:not([contenteditable="false"])') !== null);

/** Clicks the mounted editor Edit action when the unmodified E shortcut is available. */
export const useEditorEditShortcut = () => {
	const editActionRef = useRef<HTMLAnchorElement>(null);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (
				event.defaultPrevented ||
				event.repeat ||
				event.isComposing ||
				event.key.toLocaleLowerCase() !== "e" ||
				event.altKey ||
				event.ctrlKey ||
				event.metaKey ||
				event.shiftKey ||
				isEditingText(event.target) ||
				editActionRef.current === null
			)
				return;

			event.preventDefault();
			editActionRef.current.click();
		};

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	return editActionRef;
};
