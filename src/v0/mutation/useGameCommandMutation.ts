import { type QueryClient, useMutation, useQueryClient } from "@tanstack/react-query";
import { match } from "ts-pattern";
import type { BoardView } from "~/board/view/BoardViewSchema";
import { rebuildBoardView } from "~/board/view/rebuildBoardView";
import type { Command } from "~/command/Command";
import type { CommandResult } from "~/command/CommandResult";
import { runCommand } from "~/command/runCommand";
import type { InventoryView } from "~/inventory/view/InventoryViewSchema";
import { rebuildInventoryView } from "~/inventory/view/rebuildInventoryView";
import { loadPlayBackend } from "~/v0/query/loadPlayBackend";
import { playQueryKeys } from "~/v0/query/playQueryKeys";

interface Snapshot {
	board?: BoardView;
	inventory?: InventoryView;
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

const isStatefulStack = (state: Record<string, unknown> | undefined) =>
	Object.keys(state ?? {}).length > 0;

const cloneInventoryStack = (stack: InventoryView["slots"][number]["stack"]) => {
	if (!stack) return undefined;
	return {
		...stack,
	};
};

const patchInventorySlot = (
	inventory: InventoryView,
	slotIndex: number,
	patch: (slot: InventoryView["slots"][number]) => InventoryView["slots"][number],
) =>
	rebuildInventoryView(
		inventory.slots.map((slot) => (slot.slotIndex === slotIndex ? patch(slot) : slot)),
	);

const applyOptimisticCommand = ({
	queryClient,
	command,
}: {
	queryClient: QueryClient;
	command: Command;
}): Snapshot => {
	const snapshot: Snapshot = {};

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
			(command) => {
				snapshot.board = patchBoard(queryClient, (board) =>
					rebuildBoardView(
						board.items.filter((item) => item.id !== command.sourceBoardItemId),
					),
				);
				return snapshot;
			},
		)
		.with(
			{
				type: "inventory.place",
			},
			(command) => {
				let placedStack: InventoryView["slots"][number]["stack"];
				snapshot.inventory = patchInventory(queryClient, (inventory) => {
					const source = inventory.bySlotIndex[String(command.slotIndex)];
					if (!source?.stack) return inventory;
					placedStack = cloneInventoryStack(source.stack);

					return patchInventorySlot(inventory, source.slotIndex, (slot) => ({
						...slot,
						stack:
							source.stack && source.stack.quantity > 1
								? {
										...source.stack,
										quantity: source.stack.quantity - 1,
									}
								: undefined,
					}));
				});

				if (!placedStack) return snapshot;
				const stack = placedStack;
				snapshot.board = patchBoard(queryClient, (board) =>
					rebuildBoardView([
						...board.items,
						{
							id:
								stack.quantity === 1 || stack.stateful
									? stack.id
									: `optimistic:${stack.id}:${command.x}:${command.y}`,
							itemId: stack.itemId,
							x: command.x,
							y: command.y,
							state: stack.state,
						},
					]),
				);
				return snapshot;
			},
		)
		.with(
			{
				type: "inventory.stash",
			},
			(command) => {
				let sourceItem: BoardView["items"][number] | undefined;
				snapshot.board = patchBoard(queryClient, (board) => {
					sourceItem = board.byId[command.boardItemId];
					if (!sourceItem) return board;
					return rebuildBoardView(
						board.items.filter((item) => item.id !== command.boardItemId),
					);
				});

				if (!sourceItem) return snapshot;
				const item = sourceItem;
				snapshot.inventory = patchInventory(queryClient, (inventory) => {
					const targetSlotIndex = command.slotIndex ?? inventory.firstEmptySlotIndex;
					if (targetSlotIndex === undefined) return inventory;

					return patchInventorySlot(inventory, targetSlotIndex, (slot) => ({
						...slot,
						stack: slot.stack
							? {
									...slot.stack,
									quantity: slot.stack.quantity + 1,
								}
							: {
									id: item.id,
									itemId: item.itemId,
									quantity: 1,
									state: item.state,
									stateJson: JSON.stringify(item.state ?? {}),
									stateful: isStatefulStack(item.state),
								},
					}));
				});

				return snapshot;
			},
		)
		.with(
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

const rollback = ({ queryClient, snapshot }: { queryClient: QueryClient; snapshot?: Snapshot }) => {
	if (snapshot?.board) queryClient.setQueryData(playQueryKeys.board, snapshot.board);
	if (snapshot?.inventory) queryClient.setQueryData(playQueryKeys.inventory, snapshot.inventory);
};

const syncCommandViews = async ({
	queryClient,
	command,
}: {
	queryClient: QueryClient;
	command: Command;
}) => {
	const db = await loadPlayBackend();

	await match(command)
		.with(
			{
				type: "board.move",
			},
			{
				type: "board.swap",
			},
			{
				type: "board.merge",
			},
			{
				type: "inventory.swap",
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
			async () => {
				queryClient.setQueryData(playQueryKeys.board, await db.readBoardView());
				queryClient.setQueryData(playQueryKeys.inventory, await db.readInventoryView());
				queryClient.setQueryData(
					playQueryKeys.databaseStatus,
					await db.readDatabaseStatus(),
				);
			},
		)
		.with(
			{
				type: "upgrade.buy",
			},
			async () => {
				queryClient.setQueryData(playQueryKeys.board, await db.readBoardView());
				queryClient.setQueryData(playQueryKeys.inventory, await db.readInventoryView());
				queryClient.setQueryData(playQueryKeys.upgrades, await db.readUpgradeListView());
				queryClient.setQueryData(
					playQueryKeys.databaseStatus,
					await db.readDatabaseStatus(),
				);
			},
		)
		.exhaustive();
};

export function useGameCommandMutation<TCommand extends Command = Command>() {
	const queryClient = useQueryClient();

	return useMutation<CommandResult<TCommand>, Error, TCommand, Snapshot>({
		mutationFn(command) {
			return runCommand({
				command,
			}) as Promise<CommandResult<TCommand>>;
		},
		onMutate(command) {
			return applyOptimisticCommand({
				queryClient,
				command,
			});
		},
		onError(_error, _command, snapshot) {
			rollback({
				queryClient,
				snapshot,
			});
		},
		async onSuccess(_result, command) {
			await syncCommandViews({
				queryClient,
				command,
			});
		},
	});
}
