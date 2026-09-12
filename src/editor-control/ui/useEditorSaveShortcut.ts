import { useHotkey } from "@tanstack/react-hotkeys";
import { useRef, type RefObject } from "react";

/** Routes the platform Save shortcut through the surface's existing save admission. */
export const useEditorSaveShortcut = ({
	saveEnabled,
	saveFn,
	target,
}: {
	readonly saveEnabled: boolean;
	readonly saveFn: () => void | Promise<unknown>;
	readonly target?: RefObject<HTMLElement | null>;
}) => {
	const pending = useRef(false);
	useHotkey(
		"Mod+S",
		(event) => {
			if (event.repeat || event.isComposing || !saveEnabled || pending.current) return;
			pending.current = true;
			void Promise.resolve()
				.then(saveFn)
				.catch(() => undefined)
				.finally(() => {
					pending.current = false;
				});
		},
		{
			target,
			ignoreInputs: false,
			preventDefault: true,
			stopPropagation: true,
		},
	);
};
