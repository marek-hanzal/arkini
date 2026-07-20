import { motion } from "motion/react";
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

/** Registers one Board coordinate as a stable actor anchor and drop target. */
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
			data-ui="BoardCell"
			data-board-x={x}
			data-board-y={y}
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
