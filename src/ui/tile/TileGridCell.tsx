import { motion } from "motion/react";
import { memo, useMemo } from "react";

import type { TileIdentity } from "~/ui/tile/TileIdentity";
import type { TileSurface } from "~/ui/tile/TileSurface";
import { useTileSlot } from "~/ui/tile/useTileSlot";

export namespace TileGridCell {
	export interface Props {
		readonly surface: TileSurface;
		readonly x: number;
		readonly y: number;
		readonly occupant: TileIdentity | null;
		readonly toneRowOffset: number;
		readonly dataUi: string;
	}
}

/** Registers and renders one stable coordinate shared by every tile grid surface. */
const TileGridCellComponent = ({
	surface,
	x,
	y,
	occupant,
	toneRowOffset,
	dataUi,
}: TileGridCell.Props) => {
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
	const occupantId = occupant?.id ?? null;
	const occupantRevision = occupant?.revision ?? null;
	const occupantIdentity = useMemo(
		() =>
			occupantId === null || occupantRevision === null
				? null
				: {
						id: occupantId,
						revision: occupantRevision,
					},
		[
			occupantId,
			occupantRevision,
		],
	);
	const drop = useTileSlot({
		surface,
		slot,
		occupant: occupantIdentity,
	});
	const tone = (x + y + toneRowOffset) % 2 === 0 ? "a" : "b";

	return (
		<div
			ref={drop.ref}
			className="relative min-h-0 min-w-0 overflow-hidden"
			style={{
				gridColumnStart: x + 1,
				gridRowStart: y + 1,
			}}
			aria-hidden="true"
			data-ui={dataUi}
			data-tile-x={x}
			data-tile-y={y}
			data-tile-slot-tone={tone}
			data-board-x={surface.kind === "board" ? x : undefined}
			data-board-y={surface.kind === "board" ? y : undefined}
			data-toolbar-x={surface.kind === "toolbar" ? x : undefined}
			data-drop-over={drop.over ? "true" : "false"}
		>
			<motion.span
				className="pointer-events-none absolute inset-0"
				initial={false}
				animate={
					drop.over
						? {
								backgroundColor: "var(--ak-tile-grid-slot-hover-surface)",
								boxShadow: "inset 0 0 0 2px var(--ak-tile-grid-slot-hover-ring)",
								opacity: 1,
							}
						: {
								backgroundColor: "transparent",
								boxShadow: "inset 0 0 0 0 transparent",
								opacity: 0,
							}
				}
				transition={{
					type: "spring",
					stiffness: 190,
					damping: 22,
					mass: 0.62,
				}}
			/>
		</div>
	);
};

const sameOccupant = (
	left: TileGridCell.Props["occupant"],
	right: TileGridCell.Props["occupant"],
) =>
	left === right ||
	(left !== null && right !== null && left.id === right.id && left.revision === right.revision);

const sameSurface = (left: TileGridCell.Props["surface"], right: TileGridCell.Props["surface"]) =>
	left === right ||
	(left.id === right.id &&
		left.kind === right.kind &&
		(left.kind !== "board" || (right.kind === "board" && left.space === right.space)));

/** Runtime snapshots may rebuild the grid, but only semantically changed slots render again. */
export const TileGridCell = memo(
	TileGridCellComponent,
	(previous, next) =>
		previous.x === next.x &&
		previous.y === next.y &&
		previous.toneRowOffset === next.toneRowOffset &&
		previous.dataUi === next.dataUi &&
		sameSurface(previous.surface, next.surface) &&
		sameOccupant(previous.occupant, next.occupant),
);
TileGridCell.displayName = "TileGridCell";
