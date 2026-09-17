import type { PropsWithChildren } from "react";

import { useOverlayFocus } from "~/ui/ui/useOverlayFocus";

/** Owns modal focus and keyboard isolation while the caller owns its dialog and commands. */
export const Overlay = ({
	children,
	onCloseFn,
}: PropsWithChildren<{
	readonly onCloseFn: () => void;
}>) => {
	const focus = useOverlayFocus({
		onCloseFn,
	});
	return (
		<div
			className="fixed inset-0 z-[100] grid place-items-center bg-overlay/95 p-[var(--ak-viewport-padding)]"
			data-ui="Overlay"
			tabIndex={-1}
			ref={focus.overlayRef}
			onKeyDown={focus.onKeyDownFn}
		>
			{children}
		</div>
	);
};
