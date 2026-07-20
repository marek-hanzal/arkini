import { useMemo } from "react";

import { useBoard } from "~/bridge/board/useBoard";
import type { TileSurface } from "~/ui/tile/TileSurface";

export namespace useBoardView {
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

/** Projects the live board read model into one stable surface and ordered cells. */
export const useBoardView = () => {
	const board = useBoard();
	const surface = useMemo(
		() =>
			({
				id: `board:${board.currentSpace}`,
				kind: "board",
				space: board.currentSpace,
			}) satisfies Extract<
				TileSurface,
				{
					readonly kind: "board";
				}
			>,
		[
			board.currentSpace,
		],
	);

	return useMemo(() => {
		const occupants = new Map(
			board.items.map(
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
				length: board.width * board.height,
			},
			(_, index): useBoardView.Cell => {
				const x = index % board.width;
				const y = Math.floor(index / board.width);
				return {
					index,
					x,
					y,
					occupant: occupants.get(`${x}:${y}`) ?? null,
				};
			},
		);
		return {
			title: board.title,
			currentSpace: board.currentSpace,
			width: board.width,
			height: board.height,
			surface,
			cells,
		};
	}, [
		board,
		surface,
	]);
};
