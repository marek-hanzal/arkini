import { useSuspenseQuery } from "@tanstack/react-query";
import { memo } from "react";
import { inventorySlotQueryOptions } from "~/v0/inventory/query/inventorySlotQueryOptions";
import { cn } from "~/v0/ui/cn";

export namespace InventoryCell {
	export interface Props {
		slotIndex: number;
		invalid: boolean;
	}
}

export const InventoryCell = memo(({ slotIndex, invalid }: InventoryCell.Props) => {
	const { data: slot } = useSuspenseQuery(
		inventorySlotQueryOptions({
			slotIndex,
		}),
	);

	return (
		<div
			data-ak-inventory-slot={slot.slotIndex}
			className={cn(
				"relative aspect-square border-b border-r border-slate-800 bg-slate-900/70",
				invalid && "ak-cell-error",
			)}
		/>
	);
});
