import { match } from "ts-pattern";
import { cellKey } from "~/board/util/cell";
import type { BoardView } from "~/board/view/BoardViewSchema";
import type { Command } from "~/command/Command";
import type { InventoryView } from "~/inventory/view/InventoryViewSchema";
import { resolveDropIntent } from "~/merge/resolveDropIntent";
import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";
import type { DragSource, DropTarget } from "~/v0/play/DragTypes";
import type { Feedback } from "~/v0/play/Feedback";

export namespace resolveDrop {
	export interface Props {
		context: TileEngine.DropContext<unknown, unknown, DragSource, DropTarget>;
		board: BoardView;
		inventory: InventoryView;
		feedback: Feedback;
		run(command: Command): Promise<unknown>;
	}
}

const reject = (feedback?: () => void): TileEngine.DropOutcome => {
	feedback?.();
	return "reject";
};

const ignore = (): TileEngine.DropOutcome => "ignore";

const accept = (commit: () => Promise<unknown>): TileEngine.DropOutcome => ({
	type: "accept",
	commit,
});

export const resolveDrop = async ({
	context,
	board,
	inventory,
	feedback,
	run,
}: resolveDrop.Props): Promise<TileEngine.DropOutcome> => {
	const source = context.source;
	const target = context.target;
	const ok = (commit: () => Promise<unknown>) =>
		accept(async () => {
			try {
				await commit();
			} catch (error) {
				feedback.showError(error);
				throw error;
			}
		});
	if (!target) return reject();

	try {
		return match({
			source: source.kind,
			target: target.kind,
		})
			.with(
				{
					source: "board",
					target: "cell",
				},
				async () => {
					if (source.kind !== "board" || target.kind !== "cell") return reject();
					if (target.boardItemId === source.boardItemId) return ignore();

					if (!target.boardItemId) {
						return ok(() =>
							run({
								type: "board.move",
								boardItemId: source.boardItemId,
								x: target.x,
								y: target.y,
							}),
						);
					}

					const targetItem = board.byId[target.boardItemId];
					if (!targetItem) {
						return reject(() => feedback.flashBoardCell(cellKey(target.x, target.y)));
					}

					const intent = resolveDropIntent({
						sourceItemId: source.itemId,
						targetItem,
					});

					return match(intent)
						.with(
							{
								type: "reject",
							},
							() =>
								reject(() => feedback.flashBoardCell(cellKey(target.x, target.y))),
						)
						.with(
							{
								type: "swap",
							},
							() =>
								accept(() =>
									run({
										type: "board.swap",
										sourceBoardItemId: source.boardItemId,
										targetBoardItemId: targetItem.id,
									}),
								),
						)
						.with(
							{
								type: "merge",
							},
							(merge) =>
								accept(async () => {
									await run({
										type: "board.merge",
										sourceBoardItemId: source.boardItemId,
										targetBoardItemId: targetItem.id,
									});
									if (merge.directed)
										feedback.pulseImprintCell(cellKey(target.x, target.y));
									else feedback.pulseMergeCell(cellKey(target.x, target.y));
								}),
						)
						.with(
							{
								type: "craft-input",
							},
							() =>
								accept(() =>
									run({
										type: "board.merge",
										sourceBoardItemId: source.boardItemId,
										targetBoardItemId: targetItem.id,
									}),
								),
						)
						.with(
							{
								type: "producer-input",
							},
							() =>
								accept(() =>
									run({
										type: "board.merge",
										sourceBoardItemId: source.boardItemId,
										targetBoardItemId: targetItem.id,
									}),
								),
						)
						.exhaustive();
				},
			)
			.with(
				{
					source: "board",
					target: "inventory",
				},
				async () => {
					if (source.kind !== "board") return reject();
					return ok(() =>
						run({
							type: "inventory.stash",
							boardItemId: source.boardItemId,
						}),
					);
				},
			)
			.with(
				{
					source: "inventory",
					target: "inventory-slot",
				},
				async () => {
					if (source.kind !== "inventory" || target.kind !== "inventory-slot")
						return reject();
					if (source.slotIndex === target.slotIndex) return ignore();

					return ok(() =>
						run({
							type: "inventory.swap",
							sourceSlotIndex: source.slotIndex,
							targetSlotIndex: target.slotIndex,
						}),
					);
				},
			)
			.with(
				{
					source: "inventory",
					target: "cell",
				},
				async () => {
					if (source.kind !== "inventory" || target.kind !== "cell") return reject();
					if (target.boardItemId) {
						return reject(() => feedback.flashBoardCell(cellKey(target.x, target.y)));
					}

					const sourceSlot = inventory.bySlotIndex[String(source.slotIndex)];
					if (!sourceSlot?.stack) {
						return reject(() => feedback.flashInventorySlot(source.slotIndex));
					}

					return ok(() =>
						run({
							type: "inventory.place",
							slotIndex: source.slotIndex,
							x: target.x,
							y: target.y,
						}),
					);
				},
			)
			.otherwise(() => reject());
	} catch (error) {
		feedback.showError(error);
		return reject();
	}
};
