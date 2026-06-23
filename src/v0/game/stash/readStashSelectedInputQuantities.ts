import type { GameActionResolvedInputRef } from "~/v0/game/action/GameActionResolvedInputRef";

export const readStashSelectedInputQuantities = (
	resolvedRefs: readonly GameActionResolvedInputRef[],
) => {
	const quantities = new Map<string, number>();
	for (const ref of resolvedRefs) {
		quantities.set(ref.itemId, (quantities.get(ref.itemId) ?? 0) + ref.quantity);
	}
	return quantities;
};
