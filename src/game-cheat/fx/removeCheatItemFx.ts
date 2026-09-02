import { Effect } from "effect";

import { CheatModeDisabledError } from "~/game-cheat/error/CheatModeDisabledError";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { RevisionSchema } from "~/item-revision/schema/RevisionSchema";
import { removeItemRuntimeTransitionFx } from "~/item-interaction/fx/removeItemRuntimeTransitionFx";
import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";

export namespace removeCheatItemFx {
	export interface Props {
		readonly itemId: IdSchema.Type;
		readonly revision: RevisionSchema.Type;
	}
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
