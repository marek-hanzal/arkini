import type { QueryClient } from "@tanstack/react-query";
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

export const applyOptimisticCommand = ({
	queryClient,
	command,
}: applyOptimisticCommand.Props): applyOptimisticCommand.Snapshot => {
	const snapshot: applyOptimisticCommand.Snapshot = {};

	switch (command.type) {
		case "board.move": {
			const board = queryClient.getQueryData<BoardView>(playQueryKeys.board);
			if (!board) return snapshot;

			snapshot.board = board;
			queryClient.setQueryData<BoardView>(
				playQueryKeys.board,
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
		}
		case "board.swap": {
			const board = queryClient.getQueryData<BoardView>(playQueryKeys.board);
			const source = board?.byId[command.sourceBoardItemId];
			const target = board?.byId[command.targetBoardItemId];
			if (!board || !source || !target) return snapshot;

			snapshot.board = board;
			queryClient.setQueryData<BoardView>(
				playQueryKeys.board,
				rebuildBoardView(
					board.items.map((item) => {
						if (item.id === source.id)
							return {
								...item,
								x: target.x,
								y: target.y,
							};
						if (item.id === target.id)
							return {
								...item,
								x: source.x,
								y: source.y,
							};
						return item;
					}),
				),
			);
			return snapshot;
		}
		case "inventory.swap": {
			const inventory = queryClient.getQueryData<InventoryView>(playQueryKeys.inventory);
			const source = inventory?.bySlotIndex[command.sourceSlotIndex];
			const target = inventory?.bySlotIndex[command.targetSlotIndex];
			if (!inventory || !source || !target) return snapshot;

			snapshot.inventory = inventory;
			queryClient.setQueryData<InventoryView>(
				playQueryKeys.inventory,
				rebuildInventoryView(
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
				),
			);
			return snapshot;
		}
		case "board.merge":
		case "inventory.place":
		case "inventory.stash":
		case "producer.activate":
		case "producer.withdrawInput":
		case "upgrade.buy":
			return snapshot;
	}
};
