import { useMemo } from "react";

import { useToolbar } from "~/bridge/toolbar/useToolbar";
import type { TileSurface } from "~/ui/tile/TileSurface";

export namespace useToolbarView {
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

/** Projects the live toolbar into one stable surface and ordered row of slots. */
export const useToolbarView = () => {
	const toolbar = useToolbar();
	const surface = useMemo(
		() =>
			({
				id: "toolbar",
				kind: "toolbar",
			}) satisfies Extract<
				TileSurface,
				{
					readonly kind: "toolbar";
				}
			>,
		[],
	);

	return useMemo(() => {
		const occupants = new Map(
			toolbar.items.map(
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
				length: toolbar.size,
			},
			(_, index): useToolbarView.Cell => ({
				index,
				x: index,
				y: 0,
				occupant: occupants.get(`${index}:0`) ?? null,
			}),
		);
		return {
			enabled: toolbar.size > 0,
			size: toolbar.size,
			surface,
			cells,
		};
	}, [
		surface,
		toolbar,
	]);
};
