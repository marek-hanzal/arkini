import { useEffect, useEffectEvent, useRef } from "react";

/** Routes Escape through the current form's existing discard operation. */
export const useEditorDiscardShortcut = ({
	discardEnabled,
	discardFn,
}: {
	readonly discardEnabled: boolean;
	readonly discardFn: () => void | Promise<unknown>;
}) => {
	const pending = useRef(false);
	const discard = useEffectEvent(discardFn);
	useEffect(() => {
		const onKeyDownFn = (event: KeyboardEvent) => {
			if (
				event.key !== "Escape" ||
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
		window.addEventListener("keydown", onKeyDownFn);
		return () => window.removeEventListener("keydown", onKeyDownFn);
	}, [
		discardEnabled,
	]);
};
