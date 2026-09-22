import { Effect } from "effect";
import type { SpaceOutcomeSchema } from "~/outcome/schema/SpaceOutcomeSchema";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import type { ResolvedOutcome } from "~/outcome/type/ResolvedOutcome";
import { resolveOutcomeRulesEnabledFx } from "./resolveOutcomeRulesEnabledFx";

export const resolveSpaceOutcomeFx = Effect.fn("resolveSpaceOutcomeFx")(function* ({
	outcome,
	origin,
}: {
	readonly outcome: SpaceOutcomeSchema.Type;
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
		type: "space",
		space: outcome.space,
	} satisfies ResolvedOutcome.Space;
});
