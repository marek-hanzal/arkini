import { Effect } from "effect";

import { CheatModeDisabledError } from "~/engine/cheat/error/CheatModeDisabledError";
import { removeItemRuntimeTransitionFx } from "~/engine/runtime/fx/removeItemRuntimeTransitionFx";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import type { removeItemFx } from "~/engine/runtime/write/removeItemFx";

export namespace removeCheatItemFx {
	export type Props = removeItemFx.Props;
}

/** Authorizes one cheat removal before delegating to the canonical item-removal command. */
export const removeCheatItemFx = Effect.fn("removeCheatItemFx")(function* (
	props: removeCheatItemFx.Props,
) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			if (!runtime.cheats.enabled) {
				return yield* Effect.fail(
					new CheatModeDisabledError({
						command: "remove-item",
					}),
				);
			}
			const removal = yield* removeItemRuntimeTransitionFx({
				...props,
				runtime,
			});
			return [
				removal.item,
				removal.runtime,
				removal.events,
			] as const;
		}),
	);
});
