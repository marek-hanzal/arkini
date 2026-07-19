import { useMemo } from "react";

import type { useBoard } from "~/bridge/board/useBoard";
import type { TileSurface } from "~/ui/tile/TileSurface";
import { useTileSlot } from "~/ui/tile/useTileSlot";

export namespace BoardCell {
	export interface Props {
		readonly surface: Extract<
			TileSurface,
			{
				readonly kind: "board";
			}
		>;
		readonly x: number;
		readonly y: number;
		readonly occupant: useBoard.Item | null;
	}
}

/** Registers one Board coordinate as a universal tile drop slot. */
export const BoardCell = ({ surface, x, y, occupant }: BoardCell.Props) => {
	const slot = useMemo(
		() => ({
			id: `${x}:${y}`,
			x,
			y,
		}),
		[
			x,
			y,
		],
	);
	const occupantIdentity = useMemo(
		() =>
			occupant === null
				? null
				: {
						id: occupant.id,
						revision: occupant.revision,
					},
		[
			occupant,
		],
	);
	const drop = useTileSlot({
		surface,
		slot,
		occupant: occupantIdentity,
	});

	return (
		<div
			ref={drop.ref}
			className={`min-h-0 min-w-0 rounded-[22%] border transition-[border-color,background-color,filter] duration-100 ${
				drop.over
					? "border-accent bg-accent/20 brightness-110"
					: "border-line/60 bg-surface-raised/45"
			}`}
			style={{
				gridColumnStart: x + 1,
				gridRowStart: y + 1,
			}}
			aria-hidden="true"
			data-ui="BoardCell"
			data-board-x={x}
			data-board-y={y}
			data-drop-over={drop.over ? "true" : "false"}
		/>
	);
};
