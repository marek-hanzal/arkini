import type { QueryClient } from "@tanstack/react-query";
import type { stashBoardItemFx } from "~/v0/inventory/fx/stashBoardItemFx";
import type { BoardView } from "~/v0/board/view/BoardViewSchema";
import { rebuildBoardView } from "~/v0/board/view/rebuildBoardView";
import type { CacheSnapshot } from "~/v0/play/cache/CacheSnapshot";
import { isStatefulStack } from "~/v0/inventory/cache/isStatefulStack";
import { patchBoardViewCache } from "~/v0/board/cache/patchBoardViewCache";
import { patchInventorySlotCache } from "~/v0/inventory/cache/patchInventorySlotCache";
import { patchInventoryViewCache } from "~/v0/inventory/cache/patchInventoryViewCache";

export namespace applyInventoryStashCachePatch {
	export interface Props {
		queryClient: QueryClient;
		input: stashBoardItemFx.Props;
	}
}

export const applyInventoryStashCachePatch = ({
	queryClient,
	input,
}: applyInventoryStashCachePatch.Props): CacheSnapshot.Type => {
	const snapshot: CacheSnapshot.Type = {};
	let sourceItem: BoardView["items"][number] | undefined;

	snapshot.board = patchBoardViewCache({
		queryClient,
		patch: (board) => {
			sourceItem = board.byId[input.boardItemId];
			if (!sourceItem) return board;

			return rebuildBoardView(board.items.filter((item) => item.id !== input.boardItemId));
		},
	});

	if (!sourceItem) return snapshot;

	const item = sourceItem;
	snapshot.inventory = patchInventoryViewCache({
		queryClient,
		patch: (inventory) => {
			const targetSlotIndex = input.slotIndex ?? inventory.firstEmptySlotIndex;
			if (targetSlotIndex === undefined) return inventory;

			return patchInventorySlotCache({
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
