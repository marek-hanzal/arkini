import { Effect } from "effect";
import type { ItemOutcomeSchema } from "~/outcome/schema/ItemOutcomeSchema";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import type { ResolvedOutcome } from "~/outcome/type/ResolvedOutcome";
import { resolveOutcomeRulesEnabledFx } from "./resolveOutcomeRulesEnabledFx";
import { rollQuantityFx } from "./rollQuantityFx";

/** A rejected item consumes no quantity randomness and is never replaced. */
export const resolveItemOutcomeFx = Effect.fn("resolveItemOutcomeFx")(function* ({
	outcome,
	origin,
}: {
	readonly outcome: ItemOutcomeSchema.Type;
	readonly origin: BoardLocationSchema.Type;
}) {
	if (
		!(yield* resolveOutcomeRulesEnabledFx({
			origin,
			rules: outcome.rules,
		}))
	)
		return undefined;
	return {
		type: "item",
		itemUid: outcome.itemUid,
		placement: outcome.placement,
		quantity: yield* rollQuantityFx({
			quantity: outcome.quantity,
		}),
	} satisfies ResolvedOutcome.Item;
});
