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
				"absolute inset-0 block h-auto w-auto border-0 bg-purple-950/12 p-0 transition-opacity duration-200 ease-out",
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
				"absolute inset-x-0 bottom-0 mx-auto flex max-h-[var(--ak-sheet-max-height)] min-h-0 w-[var(--ak-sheet-width)] max-w-[100dvw] overflow-hidden border-x border-t border-pink-200 bg-white text-ak-text transition-[opacity,transform] duration-200 ease-out",
				open
					? "pointer-events-auto translate-y-0 opacity-100"
					: "pointer-events-none translate-y-[calc(100%+16px)] opacity-0",
				className,
			)}
			style={{
				zIndex: "var(--ak-layer-overlay-panel)",
			}}
		>
			<div className="min-h-0 max-h-[inherit] w-full overflow-y-auto overflow-x-hidden overscroll-contain bg-white pb-[env(safe-area-inset-bottom)]">
				{children}
			</div>
		</section>
	</div>
);
