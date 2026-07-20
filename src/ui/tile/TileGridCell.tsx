import { motion } from "motion/react";
import { useMemo } from "react";

import type { TileIdentity } from "~/ui/tile/TileIdentity";
import type { TileSurface } from "~/ui/tile/TileSurface";
import { useTileSlot } from "~/ui/tile/useTileSlot";

export namespace TileGridCell {
	export interface Props {
		readonly surface: TileSurface;
		readonly x: number;
		readonly y: number;
		readonly occupant: TileIdentity | null;
		readonly dataUi: string;
	}
}

/** Registers and renders one stable coordinate shared by every tile grid surface. */
export const TileGridCell = ({ surface, x, y, occupant, dataUi }: TileGridCell.Props) => {
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

	return (
		<div
			ref={drop.ref}
			className="relative min-h-0 min-w-0"
			style={{
				gridColumnStart: x + 1,
				gridRowStart: y + 1,
			}}
			aria-hidden="true"
			data-ui={dataUi}
			data-tile-x={x}
			data-tile-y={y}
			data-board-x={surface.kind === "board" ? x : undefined}
			data-board-y={surface.kind === "board" ? y : undefined}
			data-toolbar-x={surface.kind === "toolbar" ? x : undefined}
			data-drop-over={drop.over ? "true" : "false"}
		>
			<motion.span
				className="pointer-events-none absolute inset-0 rounded-[22%] border"
				initial={false}
				animate={
					drop.over
						? {
								borderColor: "var(--ak-accent)",
								backgroundColor:
									"color-mix(in srgb, var(--ak-accent) 20%, var(--ak-surface-raised))",
								scale: 1.035,
							}
						: {
								borderColor: "color-mix(in srgb, var(--ak-line) 60%, transparent)",
								backgroundColor:
									"color-mix(in srgb, var(--ak-surface-raised) 45%, transparent)",
								scale: 1,
							}
				}
				transition={{
					type: "spring",
					stiffness: 520,
					damping: 38,
					mass: 0.55,
				}}
			/>
		</div>
	);
};
