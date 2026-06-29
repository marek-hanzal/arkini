import { Effect } from "effect";
import type { GameActionResolvedInputRef } from "~/v0/game/action/GameActionResolvedInputRef";
import type { GameItemQuantityIndex } from "~/v0/game/quantity/GameItemQuantityIndex";

export namespace sumResolvedInputRefsFx {
	export interface Props {
		refs: readonly GameActionResolvedInputRef[];
	}
}

export const sumResolvedInputRefsFx = Effect.fn("sumResolvedInputRefsFx")(function* ({
	refs,
}: sumResolvedInputRefsFx.Props) {
	const quantities: Record<string, number> = {};
	for (const ref of refs) {
		quantities[ref.itemId] = (quantities[ref.itemId] ?? 0) + ref.quantity;
	}
	return quantities satisfies GameItemQuantityIndex;
});
