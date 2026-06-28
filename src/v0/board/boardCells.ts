import { cellKey } from "~/v0/board/cellKey";

export interface BoardCellView {
	x: number;
	y: number;
	key: string;
}

export namespace readBoardCells {
	export interface Props {
		width: number;
		height: number;
	}
}

export const readBoardCells = ({ width, height }: readBoardCells.Props): BoardCellView[] =>
	Array.from(
		{
			length: width * height,
		},
		(_, index) => ({
			x: index % width,
			y: Math.floor(index / width),
			key: cellKey(index % width, Math.floor(index / width)),
		}),
	);
