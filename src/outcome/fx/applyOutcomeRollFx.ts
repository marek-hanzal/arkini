import { Effect } from "effect";
import { match } from "ts-pattern";
import type { ResolvedOutcomeRoll } from "~/outcome/type/ResolvedOutcomeRoll";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import { applyItemOutcomeFx } from "./applyItemOutcomeFx";
import { applySpaceOutcomeFn } from "~/outcome/fn/applySpaceOutcomeFn";
import type { planBestEffortDropPlacementFx } from "~/item-placement/fx/planBestEffortDropPlacementFx";

export namespace applyOutcomeRollFx {
	export interface Props {
		readonly roll: ResolvedOutcomeRoll;
		readonly runtime: RuntimeSchema.Type;
		readonly overflow?: "discard";
		readonly excludedLocations?: readonly BoardLocationSchema.Type[];
	}
	export interface Result {
		readonly runtime: RuntimeSchema.Type;
		readonly item: readonly applyItemOutcomeFx.Placement[];
		readonly discarded: readonly planBestEffortDropPlacementFx.Discarded[];
	}
}

/** The complete resolved roll is available here before any of its results are applied. */
export const applyOutcomeRollFx = Effect.fn("applyOutcomeRollFx")(function* ({
	roll,
	runtime,
	overflow,
	excludedLocations,
}: applyOutcomeRollFx.Props) {
	let draft = runtime;
	const item: applyItemOutcomeFx.Placement[] = [];
	const discarded: planBestEffortDropPlacementFx.Discarded[] = [];
	for (const outcome of roll.outcome) {
		yield* match(outcome)
			.with(
				{
					type: "item",
				},
				(drop) =>
					Effect.gen(function* () {
						const [placement, next, loss] = yield* applyItemOutcomeFx({
							drop,
							origin: roll.origin,
							runtime: draft,
							overflow,
							excludedLocations,
						});
						draft = next;
						item.push(placement);
						discarded.push(...loss);
					}),
			)
			.with(
				{
					type: "space",
				},
				(outcome) =>
					Effect.gen(function* () {
						draft = applySpaceOutcomeFn({
							outcome,
							runtime: draft,
						});
					}),
			)
			.exhaustive();
	}
	return {
		runtime: draft,
		item,
		discarded,
	} satisfies applyOutcomeRollFx.Result;
});
