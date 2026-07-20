import { useMemo } from "react";

import { useBoard } from "~/bridge/board/useBoard";
import type { TileSurface } from "~/ui/tile/TileSurface";

export namespace useBoardView {
	export interface Cell {
		readonly index: number;
		readonly x: number;
		readonly y: number;
		readonly occupant: useBoard.Item | null;
	}
}

/** Projects the live board read model into stable surface, cell, and layout presentation facts. */
export const useBoardView = () => {
	const board = useBoard();
	return useMemo(() => {
		const surface = {
			id: `board:${board.currentSpace}`,
			kind: "board",
			space: board.currentSpace,
		} satisfies Extract<
			TileSurface,
			{
				readonly kind: "board";
			}
		>;
		const occupants = new Map(
			board.items.map(
				(item) =>
					[
						`${item.x}:${item.y}`,
						item,
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
			surface,
			cells,
			frameStyle: {
				aspectRatio: `${board.width} / ${board.height}`,
				"--board-width-from-height": `${(board.width / board.height) * 100}cqh`,
				"--board-height-from-width": `${(board.height / board.width) * 100}cqw`,
			},
			gridStyle: {
				gridTemplateColumns: `repeat(${board.width}, minmax(0, 1fr))`,
				gridTemplateRows: `repeat(${board.height}, minmax(0, 1fr))`,
			},
		};
	}, [
		board,
	]);
};
