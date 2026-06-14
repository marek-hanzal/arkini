import { AnimatePresence, motion } from "motion/react";
import { memo, type CSSProperties, type FC } from "react";
import { boardColumns } from "~/board/boardColumns";
import { boardRows } from "~/board/boardRows";
import { boardSourceId } from "~/board/boardSourceId";
import { BoardTile } from "~/board/ui/BoardTile";
import { useProducerClock } from "~/producer/hook/useProducerClock";
import { visualBoardItemKey, type useVisualItemMotions } from "~/play/hook/useVisualItemMotions";
import type { BoardViewItem, ViewItem } from "~/play/logic/playTypes";
import type { VisualItemMotion } from "~/play/logic/visualItemMotionMachine";

const layoutTransition = {
	duration: 0.26,
	ease: [
		0.22,
		1,
		0.36,
		1,
	],
} as const;

const boardItemSlotStyle = (
	item: BoardViewItem,
	motion: VisualItemMotion | undefined,
): CSSProperties => ({
	left: `${(item.x * 100) / boardColumns}%`,
	top: `${(item.y * 100) / boardRows}%`,
	width: `${100 / boardColumns}%`,
	height: `${100 / boardRows}%`,
	paddingRight: item.x === boardColumns - 1 ? 0 : 1,
	paddingBottom: item.y === boardRows - 1 ? 0 : 1,
	zIndex: motion?.priority === "raised" ? 30 : 0,
});

const initialFromMotion = (motion: VisualItemMotion | undefined) =>
	motion
		? {
				x: motion.from.left - motion.to.left,
				y: motion.from.top - motion.to.top,
				scaleX: motion.to.width > 0 ? motion.from.width / motion.to.width : 1,
				scaleY: motion.to.height > 0 ? motion.from.height / motion.to.height : 1,
				opacity: 1,
			}
		: false;

export namespace BoardItemLayer {
	export interface Actions {
		tileSingleActivate(item: BoardViewItem): void;
		tileLongActivate(item: BoardViewItem): void;
	}

	export interface Props {
		boardItems: readonly BoardViewItem[];
		items: Record<string, ViewItem>;
		isSourceHidden(sourceId: string): boolean;
		visualMotions: useVisualItemMotions.State;
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
	({ boardItems, items, isSourceHidden, visualMotions, actions }) => {
		const nowMs = useProducerClock(boardItems);

		return (
			<div className="pointer-events-none absolute inset-0 z-10">
				<AnimatePresence initial={false}>
					{boardItems.map((boardItem) => {
						const item = items[boardItem.itemId];
						if (!item) return null;

						const motionKey = visualBoardItemKey(boardItem.id);
						const visualMotion = visualMotions.motions[motionKey];

						return (
							<motion.div
								key={boardItem.id}
								layout={visualMotion ? false : "position"}
								initial={initialFromMotion(visualMotion)}
								animate={{
									x: 0,
									y: 0,
									scaleX: 1,
									scaleY: 1,
									opacity: 1,
								}}
								exit={{
									opacity: 0,
									scale: 0.84,
								}}
								transition={layoutTransition}
								className="pointer-events-auto absolute box-border origin-top-left"
								style={boardItemSlotStyle(boardItem, visualMotion)}
								onAnimationComplete={() => {
									if (visualMotion)
										visualMotions.settle(motionKey, visualMotion.nonce);
								}}
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
				</AnimatePresence>
			</div>
		);
	},
);
