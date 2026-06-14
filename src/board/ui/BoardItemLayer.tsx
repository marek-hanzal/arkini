import { motion } from "motion/react";
import { memo, type CSSProperties, type FC } from "react";
import { boardColumns } from "~/board/boardColumns";
import { boardRows } from "~/board/boardRows";
import { boardSourceId } from "~/board/boardSourceId";
import { BoardTile } from "~/board/ui/BoardTile";
import { useProducerClock } from "~/producer/hook/useProducerClock";
import type { BoardViewItem, ViewItem } from "~/play/logic/playTypes";

const layoutTransition = {
	duration: 0.26,
	ease: [
		0.22,
		1,
		0.36,
		1,
	],
} as const;

const boardItemSlotStyle = (item: BoardViewItem): CSSProperties => ({
	left: `${(item.x * 100) / boardColumns}%`,
	top: `${(item.y * 100) / boardRows}%`,
	width: `${100 / boardColumns}%`,
	height: `${100 / boardRows}%`,
	paddingRight: item.x === boardColumns - 1 ? 0 : 1,
	paddingBottom: item.y === boardRows - 1 ? 0 : 1,
});

export namespace BoardItemLayer {
	export interface Actions {
		tileSingleActivate(item: BoardViewItem): void;
		tileLongActivate(item: BoardViewItem): void;
	}

	export interface Props {
		boardItems: readonly BoardViewItem[];
		items: Record<string, ViewItem>;
		isSourceHidden(sourceId: string): boolean;
		actions: Actions;
	}
}

/**
 * Renders board item tiles as stable actors above the board-cell grid.
 *
 * Cells own droppable geometry and feedback only. Item DOM nodes no longer jump
 * between cell parents; they keep their identity and Motion animates their slot
 * coordinates when the engine state changes.
 */
export const BoardItemLayer: FC<BoardItemLayer.Props> = memo(
	({ boardItems, items, isSourceHidden, actions }) => {
		const nowMs = useProducerClock(boardItems);

		return (
			<div className="pointer-events-none absolute inset-0 z-10">
				{boardItems.map((boardItem) => {
					const item = items[boardItem.itemId];
					if (!item) return null;

					return (
						<motion.div
							key={boardItem.id}
							layout="position"
							transition={layoutTransition}
							className="pointer-events-auto absolute box-border"
							style={boardItemSlotStyle(boardItem)}
						>
							<BoardTile
								boardItem={boardItem}
								item={item}
								activationNowMs={boardItem.activation ? nowMs : undefined}
								hidden={isSourceHidden(boardSourceId(boardItem.id))}
								onSingleActivate={actions.tileSingleActivate}
								onLongActivate={actions.tileLongActivate}
							/>
						</motion.div>
					);
				})}
			</div>
		);
	},
);
