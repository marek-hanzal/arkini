import { resolveOutcomeRulesEnabledFx } from "./resolveOutcomeRulesEnabledFx";
import { Effect } from "effect";
import { match } from "ts-pattern";
import type { OutcomeTableSchema } from "~/outcome/schema/OutcomeTableSchema";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import type { ResolvedOutcome } from "~/outcome/type/ResolvedOutcome";
import { RuntimeFx } from "~/game-runtime/context/RuntimeFx";
import type { ResolvedOutcomeRoll } from "~/outcome/type/ResolvedOutcomeRoll";
import { selectRollSetFx } from "./selectRollSetFx";
import { rollFx } from "./rollFx";
import { resolveItemOutcomeFx } from "./resolveItemOutcomeFx";
import { resolveSpaceOutcomeFx } from "./resolveSpaceOutcomeFx";

export namespace resolveOutcomeTableFx {
	export interface Props {
		readonly ownerItemId: IdSchema.Type;
		readonly origin: BoardLocationSchema.Type;
		readonly outcome: OutcomeTableSchema.Type;
	}
	export interface Result {
		readonly roll: readonly ResolvedOutcomeRoll[];
	}
}

/** Resolves each complete roll against the caller's pinned snapshot without applying it. */
export const resolveOutcomeTableFx = Effect.fn("resolveOutcomeTableFx")(function* ({
	ownerItemId,
	origin,
	outcome,
}: resolveOutcomeTableFx.Props) {
	const selected = yield* selectRollSetFx({
		set: outcome.set,
		origin,
	});
	if (selected === undefined)
		return {
			roll: [],
		} satisfies resolveOutcomeTableFx.Result;
	const rolls: ResolvedOutcomeRoll[] = [];
	for (const roll of selected.roll) {
		const selectedOutcomes = yield* rollFx({
			roll,
		});
		const results = yield* Effect.forEach(
			selectedOutcomes.outcome,
			(entry): Effect.Effect<ResolvedOutcome | undefined, never, RuntimeFx> =>
				match(entry)
					.with(
						{
							type: "item",
						},
						(outcome) =>
							resolveItemOutcomeFx({
								outcome,
								origin,
							}),
					)
					.with(
						{
							type: "space",
						},
						(outcome) =>
							resolveSpaceOutcomeFx({
								outcome,
								origin,
							}),
					)
					.with(
						{
							type: "template",
						},
						(outcome) =>
							Effect.gen(function* () {
								if (
									!(yield* resolveOutcomeRulesEnabledFx({
										origin,
										rules: outcome.rules,
									}))
								)
									return undefined;
								return {
									type: "template",
									templateUid: outcome.templateUid,
								} satisfies ResolvedOutcome.Template;
							}),
					)
					.exhaustive(),
		);
		rolls.push({
			ownerItemId,
			origin,
			outcome: results.filter((result) => result !== undefined),
		});
	}
	return {
		roll: rolls,
	} satisfies resolveOutcomeTableFx.Result;
});
