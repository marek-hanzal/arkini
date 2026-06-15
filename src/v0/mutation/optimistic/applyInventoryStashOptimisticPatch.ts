import type { QueryClient } from "@tanstack/react-query";
import type { stashFx } from "~/inventory/fx/stashFx";
import type { BoardView } from "~/board/view/BoardViewSchema";
import { rebuildBoardView } from "~/board/view/rebuildBoardView";
import type { OptimisticSnapshot } from "~/v0/mutation/OptimisticSnapshot";
import { isStatefulStack } from "~/v0/mutation/optimistic/isStatefulStack";
import { patchBoardView } from "~/v0/mutation/optimistic/patchBoardView";
import { patchInventorySlot } from "~/v0/mutation/optimistic/patchInventorySlot";
import { patchInventoryView } from "~/v0/mutation/optimistic/patchInventoryView";

export namespace applyInventoryStashOptimisticPatch {
	export interface Props {
		queryClient: QueryClient;
		input: stashFx.Props;
	}
}

export const applyInventoryStashOptimisticPatch = ({
	queryClient,
	input,
}: applyInventoryStashOptimisticPatch.Props): OptimisticSnapshot => {
	const snapshot: OptimisticSnapshot = {};
	let sourceItem: BoardView["items"][number] | undefined;

	snapshot.board = patchBoardView({
		queryClient,
		patch: (board) => {
			sourceItem = board.byId[input.boardItemId];
			if (!sourceItem) return board;

			return rebuildBoardView(board.items.filter((item) => item.id !== input.boardItemId));
		},
	});

	if (!sourceItem) return snapshot;

	const item = sourceItem;
	snapshot.inventory = patchInventoryView({
		queryClient,
		patch: (inventory) => {
			const targetSlotIndex = input.slotIndex ?? inventory.firstEmptySlotIndex;
			if (targetSlotIndex === undefined) return inventory;

			return patchInventorySlot({
				inventory,
				slotIndex: targetSlotIndex,
				patch: (slot) => ({
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
				}),
			});
		},
	});

	return snapshot;
};
