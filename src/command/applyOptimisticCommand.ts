import type { QueryClient } from "@tanstack/react-query";
import { match } from "ts-pattern";
import type { BoardView } from "~/board/view/BoardViewSchema";
import { rebuildBoardView } from "~/board/view/rebuildBoardView";
import type { InventoryView } from "~/inventory/view/InventoryViewSchema";
import { rebuildInventoryView } from "~/inventory/view/rebuildInventoryView";
import { playQueryKeys } from "~/play/hook/playQueryKeys";
import type { Command } from "./Command";

export namespace applyOptimisticCommand {
	export interface Props {
		queryClient: QueryClient;
		command: Command;
	}

	export interface Snapshot {
		board?: BoardView;
		inventory?: InventoryView;
	}
}

const patchBoard = (queryClient: QueryClient, patch: (board: BoardView) => BoardView) => {
	let previous: BoardView | undefined;
	queryClient.setQueryData<BoardView>(playQueryKeys.board, (board) => {
		if (!board) return board;
		previous = board;
		return patch(board);
	});
	return previous;
};

const patchInventory = (
	queryClient: QueryClient,
	patch: (inventory: InventoryView) => InventoryView,
) => {
	let previous: InventoryView | undefined;
	queryClient.setQueryData<InventoryView>(playQueryKeys.inventory, (inventory) => {
		if (!inventory) return inventory;
		previous = inventory;
		return patch(inventory);
	});
	return previous;
};

export const applyOptimisticCommand = ({
	queryClient,
	command,
}: applyOptimisticCommand.Props): applyOptimisticCommand.Snapshot => {
	const snapshot: applyOptimisticCommand.Snapshot = {};

	return match(command)
		.with(
			{
				type: "board.move",
			},
			(command) => {
				snapshot.board = patchBoard(queryClient, (board) =>
					rebuildBoardView(
						board.items.map((item) =>
							item.id === command.boardItemId
								? {
										...item,
										x: command.x,
										y: command.y,
									}
								: item,
						),
					),
				);
				return snapshot;
			},
		)
		.with(
			{
				type: "board.swap",
			},
			(command) => {
				snapshot.board = patchBoard(queryClient, (board) => {
					const source = board.byId[command.sourceBoardItemId];
					const target = board.byId[command.targetBoardItemId];
					if (!source || !target) return board;

					return rebuildBoardView(
						board.items.map((item) => {
							if (item.id === source.id) {
								return {
									...item,
									x: target.x,
									y: target.y,
								};
							}
							if (item.id === target.id) {
								return {
									...item,
									x: source.x,
									y: source.y,
								};
							}
							return item;
						}),
					);
				});
				return snapshot;
			},
		)
		.with(
			{
				type: "inventory.swap",
			},
			(command) => {
				snapshot.inventory = patchInventory(queryClient, (inventory) => {
					const source = inventory.bySlotIndex[String(command.sourceSlotIndex)];
					const target = inventory.bySlotIndex[String(command.targetSlotIndex)];
					if (!source || !target) return inventory;

					return rebuildInventoryView(
						inventory.slots.map((slot) => {
							if (slot.slotIndex === source.slotIndex) {
								return {
									...slot,
									stack: target.stack,
								};
							}
							if (slot.slotIndex === target.slotIndex) {
								return {
									...slot,
									stack: source.stack,
								};
							}
							return slot;
						}),
					);
				});
				return snapshot;
			},
		)
		.with(
			{
				type: "board.merge",
			},
			{
				type: "inventory.place",
			},
			{
				type: "inventory.stash",
			},
			{
				type: "activation.activate",
			},
			{
				type: "activation.withdrawInput",
			},
			{
				type: "craft.claim",
			},
			{
				type: "upgrade.buy",
			},
			() => snapshot,
		)
		.exhaustive();
};
