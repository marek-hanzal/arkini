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
			className="relative min-w-0 border-b border-pink-200/80 bg-white/88 px-4 py-3 pr-14"
		>
			<div className="min-w-0">
				<h2 className="truncate text-base font-black text-ak-text">{title}</h2>
				{description ? (
					<p className="ak-ui-muted mt-1 break-words text-sm">{description}</p>
				) : null}
			</div>
			<button
				type="button"
				aria-label="Close sheet"
				className="absolute right-2 top-2 grid h-10 w-10 place-items-center rounded-sm border border-pink-200/90 bg-white/82 text-lg font-black leading-none text-ak-text shadow-sm transition hover:border-fuchsia-300 hover:bg-fuchsia-50 active:translate-y-px"
				onClick={onClose}
			>
				✕
			</button>
		</div>
	);
};
