import type { ReactNode } from "react";

export namespace SheetHeader {
	export interface Props {
		eyebrow: string;
		description: ReactNode;
		anchor?: "inventory-summary";
		onClose(): void;
	}
}

export function SheetHeader({ eyebrow, description, anchor, onClose }: SheetHeader.Props) {
	return (
		<div
			data-inventory-summary={anchor === "inventory-summary" ? "" : undefined}
			className="flex items-center justify-between gap-3 border-b border-slate-800/80 p-4"
		>
			<div>
				<p className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-emerald-300">
					{eyebrow}
				</p>
				<p className="text-sm text-slate-300">{description}</p>
			</div>
			<button
				type="button"
				className="rounded-sm border border-slate-700 px-2 py-1 text-xs text-slate-300"
				onClick={onClose}
			>
				Close
			</button>
		</div>
	);
}
