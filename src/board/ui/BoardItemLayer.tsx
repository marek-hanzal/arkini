import { AnimatePresence, motion } from "motion/react";
import { memo, type CSSProperties, type FC, useCallback, useRef } from "react";
import { boardColumns } from "~/board/boardColumns";
import { boardRows } from "~/board/boardRows";
import { boardSourceId } from "~/board/boardSourceId";
import { BoardTile } from "~/board/ui/BoardTile";
import { useVisualItemMotionAnimation } from "~/animation/useVisualItemMotionAnimation";
import { useProducerClock } from "~/producer/hook/useProducerClock";
import { visualBoardItemKey, type useVisualItemMotions } from "~/play/hook/useVisualItemMotions";
import type { BoardViewItem, ViewItem } from "~/play/logic/playTypes";
import type { VisualItemMotion } from "~/play/logic/visualItemMotionMachine";

const exitTransition = {
	duration: 0.18,
	ease: [
		0.65,
		0,
		0.35,
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
		visualMotions: useVisualItemMotions.State;
		actions: Actions;
	}
}

namespace BoardItemActor {
	export interface Props {
		boardItem: BoardViewItem;
		item: ViewItem;
		activationNowMs?: number;
		hidden: boolean;
		motionKey: string;
		visualMotion?: VisualItemMotion;
		settleMotion: useVisualItemMotions.State["settle"];
		actions: BoardItemLayer.Actions;
	}
}

const BoardItemActor: FC<BoardItemActor.Props> = memo(
	({
		boardItem,
		item,
		activationNowMs,
		hidden,
		motionKey,
		visualMotion,
		settleMotion,
		actions,
	}) => {
		const ref = useRef<HTMLDivElement | null>(null);
		const settle = useCallback(() => {
			if (visualMotion) settleMotion(motionKey, visualMotion.nonce);
		}, [
			motionKey,
			visualMotion,
			settleMotion,
		]);
		useVisualItemMotionAnimation({
			ref,
			motion: visualMotion,
			onSettle: settle,
		});

		return (
			<motion.div
				ref={ref}
				exit={{
					opacity: 0,
					y: 26,
					scale: 0.9,
				}}
				transition={exitTransition}
				className="pointer-events-auto absolute box-border origin-top-left"
				style={boardItemSlotStyle(boardItem)}
			>
				<BoardTile
					boardItem={boardItem}
					item={item}
					activationNowMs={activationNowMs}
					hidden={hidden}
					onSingleActivate={actions.tileSingleActivate}
					onLongActivate={actions.tileLongActivate}
				/>
			</motion.div>
		);
	},
);

/**
 * Renders board item tiles as stable actors above the board-cell grid.
 *
 * Cells own droppable geometry and feedback only. Item DOM nodes do not jump
 * between cell parents; explicit visual motions are staged only for actors that
 * are actually affected by a game action.
 */
export const BoardItemLayer: FC<BoardItemLayer.Props> = memo(
	({ boardItems, items, isSourceHidden, visualMotions, actions }) => {
		const nowMs = useProducerClock(boardItems);

		return (
			<div className="pointer-events-none absolute inset-0">
				<AnimatePresence initial={false}>
					{boardItems.map((boardItem) => {
						const item = items[boardItem.itemId];
						if (!item) return null;

						const motionKey = visualBoardItemKey(boardItem.id);
						const visualMotion = visualMotions.motions[motionKey];

						return (
							<BoardItemActor
								key={boardItem.id}
								boardItem={boardItem}
								item={item}
								activationNowMs={boardItem.activation ? nowMs : undefined}
								hidden={isSourceHidden(boardSourceId(boardItem.id))}
								motionKey={motionKey}
								visualMotion={visualMotion}
								settleMotion={visualMotions.settle}
								actions={actions}
							/>
						);
					})}
				</AnimatePresence>
			</div>
		);
	},
);
