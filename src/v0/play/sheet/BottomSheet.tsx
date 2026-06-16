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
		className="ak-bottom-sheet"
		data-open={open ? "true" : "false"}
	>
		<button
			type="button"
			tabIndex={open ? 0 : -1}
			className="ak-bottom-sheet-backdrop"
			onClick={onClose}
		/>

		<section className={cn("ak-bottom-sheet-panel", className)}>
			<div className="ak-bottom-sheet-content">{children}</div>
		</section>
	</div>
);
