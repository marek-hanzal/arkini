import { isSpaceRetainedFn } from "~/space/fn/isSpaceRetainedFn";
import { resolveInventoryFx } from "~/space/fx/resolveInventoryFx";
import { applyBoardTemplateRuntimeFx } from "~/board-template/fx/applyBoardTemplateRuntimeFx";
import { RuntimeFx } from "~/game-runtime/context/RuntimeFx";
import { Effect } from "effect";
import { match } from "ts-pattern";
import type { ResolvedOutcomeRoll } from "~/outcome/type/ResolvedOutcomeRoll";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { applyItemOutcomeFx } from "./applyItemOutcomeFx";
import type { planBestEffortDropPlacementFx } from "~/item-placement/fx/planBestEffortDropPlacementFx";
import type { AppliedOutcome } from "~/outcome/type/AppliedOutcome";

export namespace applyOutcomeRollFx {
	export interface Props {
		readonly roll: ResolvedOutcomeRoll;
		readonly runtime: RuntimeSchema.Type;
		readonly overflow?: "discard";
	}
	export interface Result {
		readonly runtime: RuntimeSchema.Type;
		readonly effects: readonly AppliedOutcome[];
		readonly discarded: readonly planBestEffortDropPlacementFx.Discarded[];
	}
}

/** The complete resolved roll is available here before any of its results are applied. */
export const applyOutcomeRollFx = Effect.fn("applyOutcomeRollFx")(function* ({
	roll,
	runtime,
	overflow,
}: applyOutcomeRollFx.Props) {
	const previousRuntime = yield* (yield* RuntimeFx).read;
	let draft = runtime;
	const effects: AppliedOutcome[] = [];
	const discarded: planBestEffortDropPlacementFx.Discarded[] = [];
	for (const outcome of roll.outcome) {
		if (
			!isSpaceRetainedFn({
				space: roll.origin.space,
				previousRuntime,
				runtime: draft,
			})
		)
			break;
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
						});
						draft = next;
						effects.push({
							type: "item",
							placement,
						});
						discarded.push(...loss);
					}),
			)
			.with(
				{
					type: "space",
				},
				(outcome) =>
					Effect.gen(function* () {
						if (
							!isSpaceRetainedFn({
								space: outcome.space,
								previousRuntime,
								runtime: draft,
							})
						)
							return;
						// Navigation stays in the draft; publication reads only the final space.
						if (draft.currentSpace !== outcome.space)
							draft = {
								...draft,
								currentSpace: outcome.space,
							};
					}),
			)
			.with(
				{
					type: "inventory",
				},
				(outcome) =>
					Effect.gen(function* () {
						const resolved = yield* resolveInventoryFx({
							ownerItemId: outcome.ownerItemId,
							templateUid: outcome.templateUid,
							runtime: draft,
						});
						if (resolved === undefined) return;
						draft = {
							...resolved.runtime,
							currentSpace: resolved.space,
						};
						if (resolved.initialization !== undefined)
							effects.push(resolved.initialization);
					}),
			)
			.with(
				{
					type: "template",
				},
				(outcome) =>
					Effect.gen(function* () {
						const snapshot = yield* RuntimeFx;
						const applied = yield* applyBoardTemplateRuntimeFx({
							runtime: draft,
							ownershipRuntime: yield* snapshot.read,
							space: outcome.space,
							templateUid: outcome.templateUid,
						});
						draft = applied.runtime;
						effects.push({
							type: "template",
							space: outcome.space,
							templateUid: outcome.templateUid,
							removed: applied.removed,
						});
					}),
			)
			.exhaustive();
	}
	return {
		runtime: draft,
		effects,
		discarded,
	} satisfies applyOutcomeRollFx.Result;
});
