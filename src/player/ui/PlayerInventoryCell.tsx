import type { FC, ReactNode } from "react";
import { cn } from "~/shared/cn";

export namespace PlayerInventoryCell {
	export interface Props {
		slotIndex: number;
		children?: ReactNode;
	}
}

export const PlayerInventoryCell: FC<PlayerInventoryCell.Props> = ({ slotIndex, children }) => {
	return (
		<div
			className={cn(
				"relative aspect-square overflow-hidden rounded-md border border-slate-800 bg-slate-950/65",
				"ring-1 ring-slate-900/80",
			)}
			data-player-inventory-slot={slotIndex}
		>
			{children}
		</div>
	);
};
