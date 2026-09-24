import { useEffect, useEffectEvent, useRef } from "react";

/** Routes the form's Discard shortcuts through its existing discard operation. */
export const useEditorDiscardShortcut = ({
	discardEnabled,
	discardFn,
	scope = "page",
}: {
	readonly discardEnabled: boolean;
	readonly discardFn: () => void | Promise<unknown>;
	readonly scope?: "page" | "overlay" | "dialog";
}) => {
	const pending = useRef(false);
	const discard = useEffectEvent(discardFn);
	useEffect(() => {
		const discardOnKeyDownFn = (event: KeyboardEvent) => {
			if (
				event.defaultPrevented ||
				event.repeat ||
				event.isComposing ||
				!discardEnabled ||
				pending.current
			)
				return;
			event.preventDefault();
			event.stopPropagation();
			pending.current = true;
			void Promise.resolve()
				.then(discard)
				.catch(() => undefined)
				.finally(() => {
					pending.current = false;
				});
		};
		const onDiscardLetterFn = (event: KeyboardEvent) => {
			const overlay = document.querySelector('[data-ui="Overlay"]');
			const dialog = document.querySelector('[data-ui="EditorUnsavedChangesDialog"]');
			const anyDialogOpen = document.querySelector('[data-ui$="Dialog"]') !== null;
			const overlayOwnsTarget =
				event.target instanceof Node && overlay?.contains(event.target) === true;
			const dialogOwnsTarget =
				event.target instanceof Node && dialog?.contains(event.target) === true;
			const isTypingTarget =
				event.target instanceof HTMLElement &&
				(event.target.matches("input, textarea, select") ||
					event.target.closest('[contenteditable]:not([contenteditable="false"])') !==
						null);
			if (
				event.key !== "d" ||
				event.altKey ||
				event.ctrlKey ||
				event.metaKey ||
				event.shiftKey ||
				isTypingTarget ||
				(scope === "page"
					? overlay !== null || anyDialogOpen
					: scope === "overlay"
						? !overlayOwnsTarget || anyDialogOpen
						: !dialogOwnsTarget)
			)
				return;
			discardOnKeyDownFn(event);
		};
		const onEscapeKeyDownFn = (event: KeyboardEvent) => {
			if (event.key !== "Escape" || scope !== "page") return;
			discardOnKeyDownFn(event);
		};
		window.addEventListener("keydown", onDiscardLetterFn, true);
		window.addEventListener("keydown", onEscapeKeyDownFn);
		return () => {
			window.removeEventListener("keydown", onDiscardLetterFn, true);
			window.removeEventListener("keydown", onEscapeKeyDownFn);
		};
	}, [
		discardEnabled,
		scope,
	]);
};
