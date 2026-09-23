import { Effect } from "effect";
import type { resolveOutcomeTableFx } from "./resolveOutcomeTableFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { planBestEffortDropPlacementFx } from "~/item-placement/fx/planBestEffortDropPlacementFx";
import { applyOutcomeRollFx } from "./applyOutcomeRollFx";
import type { AppliedOutcome } from "~/outcome/type/AppliedOutcome";

export namespace applyOutcomeTableFx {
	export interface Props {
		readonly outcome: resolveOutcomeTableFx.Result;
		readonly runtime: RuntimeSchema.Type;
		readonly overflow?: "discard";
	}
	export interface Result {
		readonly effects: readonly AppliedOutcome[];
		readonly discarded?: readonly planBestEffortDropPlacementFx.Discarded[];
	}
}

/** Applies resolved rolls in authored order without publishing a partial operation. */
export const applyOutcomeTableFx = Effect.fn("applyOutcomeTableFx")(function* ({
	outcome,
	runtime,
	overflow,
}: applyOutcomeTableFx.Props) {
	let draft = runtime;
	const effects: AppliedOutcome[] = [];
	const discarded: planBestEffortDropPlacementFx.Discarded[] = [];
	for (const roll of outcome.roll) {
		const result = yield* applyOutcomeRollFx({
			roll,
			runtime: draft,
			overflow,
		});
		draft = result.runtime;
		effects.push(...result.effects);
		discarded.push(...result.discarded);
	}
	return [
		{
			effects,
			...(overflow === "discard"
				? {
						discarded,
					}
				: {}),
		} satisfies applyOutcomeTableFx.Result,
		draft,
	] as const;
});
