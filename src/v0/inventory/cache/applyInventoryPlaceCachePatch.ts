import type { QueryClient } from "@tanstack/react-query";
import type { placeFx } from "~/inventory/fx/placeFx";
import { rebuildBoardView } from "~/board/view/rebuildBoardView";
import type { InventoryView } from "~/inventory/view/InventoryViewSchema";
import type { CacheSnapshot } from "~/v0/play/cache/CacheSnapshot";
import { cloneInventoryStack } from "~/v0/inventory/cache/cloneInventoryStack";
import { patchBoardViewCache } from "~/v0/board/cache/patchBoardViewCache";
import { patchInventorySlotCache } from "~/v0/inventory/cache/patchInventorySlotCache";
import { patchInventoryViewCache } from "~/v0/inventory/cache/patchInventoryViewCache";

export namespace applyInventoryPlaceCachePatch {
	export interface Props {
		queryClient: QueryClient;
		input: placeFx.Props;
	}
}

export const applyInventoryPlaceCachePatch = ({
	queryClient,
	input,
}: applyInventoryPlaceCachePatch.Props): CacheSnapshot.Type => {
	const snapshot: CacheSnapshot.Type = {};
	let placedStack: InventoryView["slots"][number]["stack"];

	snapshot.inventory = patchInventoryViewCache({
		queryClient,
		patch: (inventory) => {
			const source = inventory.bySlotIndex[String(input.slotIndex)];
			if (!source?.stack) return inventory;
			placedStack = cloneInventoryStack(source.stack);

			return patchInventorySlotCache({
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
	snapshot.board = patchBoardViewCache({
		queryClient,
		patch: (board) =>
			rebuildBoardView([
				...board.items,
				{
					id:
						stack.quantity === 1 || stack.stateful
							? stack.id
							: `cache:${stack.id}:${input.x}:${input.y}`,
					itemId: stack.itemId,
					x: input.x,
					y: input.y,
					state: stack.state,
				},
			]),
	});

	return snapshot;
};
