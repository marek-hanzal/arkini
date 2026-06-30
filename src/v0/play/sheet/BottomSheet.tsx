import type { FC, ReactNode } from "react";
import { cn } from "~/v0/ui/cn";

export namespace BottomSheet {
	export interface Props {
		open: boolean;
		children: ReactNode;
		className?: string;
		onClose(): void;
	}
}

export const BottomSheet: FC<BottomSheet.Props> = ({ open, children, className, onClose }) => (
	<div
		data-ui="bottom sheet"
		data-open={open ? "true" : "false"}
		className="pointer-events-none fixed inset-0"
		style={{
			zIndex: "var(--ak-layer-overlay-root)",
		}}
	>
		<button
			type="button"
			tabIndex={open ? 0 : -1}
			className={cn(
				"absolute inset-0 block h-auto w-auto border-0 bg-black/60 p-0 transition-opacity duration-200 ease-out",
				open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
			)}
			style={{
				zIndex: "var(--ak-layer-overlay-backdrop)",
			}}
			onClick={onClose}
		/>

		<section
			data-ui="bottom sheet panel"
			className={cn(
				"absolute inset-x-0 bottom-0 mx-auto flex min-h-0 max-h-[var(--ak-sheet-max-height)] w-[var(--ak-sheet-width)] max-w-[100dvw] flex-col overflow-hidden border-x border-t border-ak-border bg-ak-surface text-ak-text transition-[opacity,transform] duration-200 ease-out",
				open
					? "pointer-events-auto translate-y-0 opacity-100"
					: "pointer-events-none translate-y-[calc(100%+16px)] opacity-0",
				className,
			)}
			style={{
				zIndex: "var(--ak-layer-overlay-panel)",
			}}
		>
			{children}
		</section>
	</div>
);
