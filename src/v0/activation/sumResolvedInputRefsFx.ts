import { Effect } from "effect";
import type { GameActionResolvedInputRef } from "~/action/GameActionResolvedInputRef";
import type { GameItemQuantityIndex } from "~/quantity/GameItemQuantityIndex";

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
