import { Effect } from "effect";
import type { GameActionResolvedInputRef } from "~/v0/game/engine/model/GameActionResolvedInputRef";

export namespace sumResolvedInputRefsFx {
	export interface Props {
		refs: GameActionResolvedInputRef[];
	}
}

export const sumResolvedInputRefsFx = Effect.fn("sumResolvedInputRefsFx")(function* ({
	refs,
}: sumResolvedInputRefsFx.Props) {
	const map = new Map<string, number>();
	for (const ref of refs) {
		map.set(ref.itemId, (map.get(ref.itemId) ?? 0) + ref.quantity);
	}
	return map;
});
