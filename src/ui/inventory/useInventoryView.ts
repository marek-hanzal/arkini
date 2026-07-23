import { useMemo } from "react";

import { useInventory } from "~/bridge/inventory/useInventory";
import type { TileSurface } from "~/ui/tile/TileSurface";

export namespace useInventoryView {
	export interface Cell {
		readonly index: number;
		readonly x: number;
		readonly y: number;
		readonly occupant: {
			readonly id: string;
			readonly revision: string;
		} | null;
	}
}

/** Projects the global inventory into one stable surface and ordered cells. */
export const useInventoryView = () => {
	const inventory = useInventory();
	const surface = useMemo(
		() =>
			({
				id: "inventory",
				kind: "inventory",
			}) satisfies Extract<
				TileSurface,
				{
					readonly kind: "inventory";
				}
			>,
		[],
	);

	return useMemo(() => {
		const occupants = new Map(
			inventory.items.map(
				(item) =>
					[
						`${item.x}:${item.y}`,
						{
							id: item.id,
							revision: item.revision,
						},
					] as const,
			),
		);
		const cells = Array.from(
			{
				length: inventory.width * inventory.height,
			},
			(_, index): useInventoryView.Cell => {
				const x = index % inventory.width;
				const y = Math.floor(index / inventory.width);
				return {
					index,
					x,
					y,
					occupant: occupants.get(`${x}:${y}`) ?? null,
				};
			},
		);
		return {
			width: inventory.width,
			height: inventory.height,
			surface,
			cells,
		};
	}, [
		inventory,
		surface,
	]);
};
