import type { IdSchema } from "~/game-value/schema/IdSchema";
import { RuntimeFx } from "~/game-runtime/context/RuntimeFx";
import { Effect } from "effect";
import type { SpaceOutcomeSchema } from "~/outcome/schema/SpaceOutcomeSchema";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import type { ResolvedOutcome } from "~/outcome/type/ResolvedOutcome";
import { resolveOutcomeRulesEnabledFx } from "./resolveOutcomeRulesEnabledFx";

export const resolveSpaceOutcomeFx = Effect.fn("resolveSpaceOutcomeFx")(function* ({
	outcome,
	ownerItemId,
	origin,
}: {
	readonly ownerItemId: IdSchema.Type;
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
	if (typeof outcome.space === "object")
		return {
			type: "inventory",
			ownerItemId,
			templateUid: outcome.space.templateUid,
		} satisfies ResolvedOutcome.Inventory;
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
