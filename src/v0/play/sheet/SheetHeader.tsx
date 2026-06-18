import type { FC, ReactNode } from "react";

export namespace SheetHeader {
	export interface Props {
		eyebrow: string;
		description: ReactNode;
		anchor?: "inventory-summary";
		onClose(): void;
	}
}

export const SheetHeader: FC<SheetHeader.Props> = ({ eyebrow, description, anchor, onClose }) => {
	return (
		<div
			data-ui="sheet header"
			data-inventory-summary={anchor === "inventory-summary" ? "" : undefined}
			className="flex min-w-0 items-center justify-between gap-3 border-b border-pink-200/80 bg-white/80 p-4"
		>
			<div className="min-w-0">
				<p className="ak-ui-eyebrow">{eyebrow}</p>
				<p className="ak-ui-muted mt-1 break-words text-sm">{description}</p>
			</div>
			<button
				type="button"
				className="ak-ui-button ak-ui-button-ghost shrink-0"
				onClick={onClose}
			>
				Close
			</button>
		</div>
	);
};
