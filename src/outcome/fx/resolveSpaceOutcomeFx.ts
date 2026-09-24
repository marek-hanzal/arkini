import { RuntimeFx } from "~/game-runtime/context/RuntimeFx";
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
	const space =
		outcome.space === "previous"
			? (yield* (yield* RuntimeFx).read).previousSpace
			: outcome.space;
	if (space === undefined) return undefined;
	return {
		type: "space",
		space,
	} satisfies ResolvedOutcome.Space;
});
