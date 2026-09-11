import { Tooltip } from "~/ui/ui/Tooltip";
import { LinkButton } from "~/ui/ui/LinkButton";
import { createPortal } from "react-dom";
import type { PropsWithChildren } from "react";
import { X } from "lucide-react";
import { useOverlayFocus } from "~/ui/ui/useOverlayFocus";

/** Keeps painting tool controls in one modal above the fixed canvas viewport. */
export const TilePaintingDialog = ({
	title,
	children,
	onCloseFn,
}: PropsWithChildren<{
	readonly title: string;
	readonly onCloseFn: () => void;
}>) => {
	const focus = useOverlayFocus({
		onCloseFn,
	});
	return createPortal(
		<div
			className="fixed inset-0 z-40 grid place-items-center bg-overlay/90 p-5"
			data-ui="TilePaintingDialogBackdrop"
			onPointerDown={(event) => {
				if (event.target === event.currentTarget) onCloseFn();
			}}
		>
			<div
				ref={focus.overlayRef}
				onKeyDown={focus.onKeyDownFn}
				className="grid max-h-[85dvh] w-full max-w-lg gap-5 overflow-y-auto rounded-2xl border border-line-strong bg-surface-raised p-5 shadow-2xl"
				data-ui="TilePaintingDialog"
			>
				<div className="flex items-center justify-between gap-3">
					<h2 className="text-lg font-semibold">{title}</h2>
					<Tooltip
						content="Close"
						contentClassName="z-50"
					>
						<LinkButton
							className="inline-flex size-9 shrink-0 items-center justify-center no-underline hover:no-underline"
							onClick={onCloseFn}
						>
							<X className="size-4" />
						</LinkButton>
					</Tooltip>
				</div>
				{children}
			</div>
		</div>,
		document.body,
	);
};
