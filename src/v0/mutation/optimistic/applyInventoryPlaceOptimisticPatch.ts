import type { QueryClient } from "@tanstack/react-query";
import type { placeFx } from "~/inventory/fx/placeFx";
import { rebuildBoardView } from "~/board/view/rebuildBoardView";
import type { InventoryView } from "~/inventory/view/InventoryViewSchema";
import type { OptimisticSnapshot } from "~/v0/mutation/OptimisticSnapshot";
import { cloneInventoryStack } from "~/v0/mutation/optimistic/cloneInventoryStack";
import { patchBoardView } from "~/v0/mutation/optimistic/patchBoardView";
import { patchInventorySlot } from "~/v0/mutation/optimistic/patchInventorySlot";
import { patchInventoryView } from "~/v0/mutation/optimistic/patchInventoryView";

export namespace applyInventoryPlaceOptimisticPatch {
	export interface Props {
		queryClient: QueryClient;
		input: placeFx.Props;
	}
}

export const applyInventoryPlaceOptimisticPatch = ({
	queryClient,
	input,
}: applyInventoryPlaceOptimisticPatch.Props): OptimisticSnapshot => {
	const snapshot: OptimisticSnapshot = {};
	let placedStack: InventoryView["slots"][number]["stack"];

	snapshot.inventory = patchInventoryView({
		queryClient,
		patch: (inventory) => {
			const source = inventory.bySlotIndex[String(input.slotIndex)];
			if (!source?.stack) return inventory;
			placedStack = cloneInventoryStack(source.stack);

			return patchInventorySlot({
				inventory,
				slotIndex: source.slotIndex,
				patch: (slot) => ({
					...slot,
					stack:
						source.stack && source.stack.quantity > 1
							? {
									...source.stack,
									quantity: source.stack.quantity - 1,
								}
							: undefined,
				}),
			});
		},
	});

	if (!placedStack) return snapshot;

	const stack = placedStack;
	snapshot.board = patchBoardView({
		queryClient,
		patch: (board) =>
			rebuildBoardView([
				...board.items,
				{
					id:
						stack.quantity === 1 || stack.stateful
							? stack.id
							: `optimistic:${stack.id}:${input.x}:${input.y}`,
					itemId: stack.itemId,
					x: input.x,
					y: input.y,
					state: stack.state,
				},
			]),
	});

	return snapshot;
};
