import type { FC, ReactNode } from "react";

export namespace SheetHeader {
	export interface Props {
		title: string;
		description?: ReactNode;
		anchor?: "inventory-summary";
		onClose(): void;
	}
}

export const SheetHeader: FC<SheetHeader.Props> = ({ title, description, anchor, onClose }) => {
	return (
		<div
			data-ui="sheet header"
			data-inventory-summary={anchor === "inventory-summary" ? "" : undefined}
			className="relative min-w-0 border-b border-pink-200 bg-white px-4 py-2.5 pr-12"
		>
			<div className="min-w-0">
				<h2 className="truncate text-base font-black text-ak-text">{title}</h2>
				{description ? (
					<p className="mt-1 break-words text-sm text-ak-text-muted">{description}</p>
				) : null}
			</div>
			<button
				type="button"
				aria-label="Close sheet"
				className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-sm border border-pink-200 bg-white text-xl font-black leading-none text-ak-text transition hover:border-fuchsia-300 hover:bg-fuchsia-50 active:translate-y-px"
				onClick={onClose}
			>
				✕
			</button>
		</div>
	);
};
