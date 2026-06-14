import { useMemo, type FC } from "react";
import type { Command } from "~/action/command";
import { pulseBottomNav } from "~/play/hook/pulseBottomNav";
import { useCommand } from "~/play/hook/useCommand";
import { usePlayBoard } from "~/play/hook/usePlayBoard";
import { usePlayDataInvalidation } from "~/play/hook/usePlayDataInvalidation";
import { usePlayItems } from "~/play/hook/usePlayItems";
import { PhaserBoard } from "~/phaser/board/PhaserBoard";
import type { BoardViewItem, ProducerDropResult } from "~/play/logic/playTypes";

export namespace Board {
	export interface Props {
		onOpenItem(boardItemId: string): void;
	}
}

export const Board: FC<Board.Props> = ({ onOpenItem }) => {
	const board = usePlayBoard().data;
	const items = usePlayItems().data;
	const invalidatePlayData = usePlayDataInvalidation();
	const command = useCommand<Command>({
		invalidateOnSuccess: false,
	});

	const handlers = useMemo(
		() =>
			({
				async move(item: BoardViewItem, x: number, y: number) {
					await command.mutateAsync({
						type: "board.move",
						boardItemId: item.id,
						x,
						y,
					});
					await invalidatePlayData([
						"board",
						"databaseStatus",
					]);
				},
				async swap(source: BoardViewItem, target: BoardViewItem) {
					await command.mutateAsync({
						type: "board.swap",
						sourceBoardItemId: source.id,
						targetBoardItemId: target.id,
					});
					await invalidatePlayData([
						"board",
						"databaseStatus",
					]);
				},
				async merge(source: BoardViewItem, target: BoardViewItem) {
					await command.mutateAsync({
						type: "board.merge",
						sourceBoardItemId: source.id,
						targetBoardItemId: target.id,
					});
					await invalidatePlayData([
						"board",
						"databaseStatus",
					]);
				},
				async activate(item: BoardViewItem, activation: "single" | "exhaust") {
					const result = (await command.mutateAsync({
						type: "producer.activate",
						boardItemId: item.id,
						activation,
					})) as ProducerDropResult;
					await invalidatePlayData([
						"board",
						"inventory",
						"databaseStatus",
					]);
					if (result.placements.some((placement) => placement.kind === "inventory")) {
						pulseBottomNav("inventory");
					}
					return result;
				},
				openDetail(item: BoardViewItem) {
					onOpenItem(item.id);
				},
			}) satisfies PhaserBoard.Handlers,
		[
			command,
			invalidatePlayData,
			onOpenItem,
		],
	);

	if (!board || !items) return null;

	return (
		<div className="relative aspect-[7/9] w-full overflow-hidden rounded-md border border-slate-800 bg-slate-950 shadow-2xl shadow-slate-950/40">
			<PhaserBoard
				board={board}
				items={items}
				handlers={handlers}
			/>
		</div>
	);
};
