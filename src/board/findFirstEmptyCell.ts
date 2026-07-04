import type { BoardCellSchema } from "~/board/schema/BoardCellSchema";
import { cellKey } from "~/board/cellKey";

export namespace findFirstEmptyCell {
	export interface Props {
		height: number;
		occupiedCellKeys: ReadonlySet<string>;
		width: number;
	}
}

export function findFirstEmptyCell({
	height,
	occupiedCellKeys,
	width,
}: findFirstEmptyCell.Props): BoardCellSchema.Type | undefined {
	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			if (!occupiedCellKeys.has(cellKey(x, y))) {
				return {
					x,
					y,
				};
			}
		}
	}

	return undefined;
}
