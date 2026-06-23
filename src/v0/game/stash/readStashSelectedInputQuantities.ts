import type { GameActionResolvedInputRef } from "~/v0/game/action/GameActionResolvedInputRef";
import type { GameItemQuantityIndex } from "~/v0/game/quantity/GameItemQuantityIndex";

export const readStashSelectedInputQuantities = (
	resolvedRefs: readonly GameActionResolvedInputRef[],
) => {
	const quantities: Record<string, number> = {};
	for (const ref of resolvedRefs) {
		quantities[ref.itemId] = (quantities[ref.itemId] ?? 0) + ref.quantity;
	}
	return quantities satisfies GameItemQuantityIndex;
};
