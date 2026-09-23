import { GameConfigFx } from "~/game-config/context/GameConfigFx";
import { Effect } from "effect";
import { match } from "ts-pattern";

import { RuntimeFx } from "~/game-runtime/context/RuntimeFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { ItemDetailLines } from "~/item-line-detail/type/ItemDetailLines";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import { outcomeRulesFx } from "~/outcome/fx/outcomeRulesFx";
import type { RollSchema } from "~/outcome/schema/RollSchema";
import { RollTypeSchema } from "~/outcome/schema/RollTypeSchema";
import type { OutcomeSchema } from "~/outcome/schema/OutcomeSchema";
import type { OutcomeRuleSchema } from "~/outcome/schema/OutcomeRuleSchema";
import type { OutcomeProjection } from "~/outcome/type/OutcomeProjection";
import type { LineSchema } from "~/production-line/schema/LineSchema";

interface ItemDetailOutcomeRuleContext {
	readonly origin: BoardLocationSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}

const readActiveRuleHintsFx = Effect.fn("readActiveOutcomeRuleHintsFx")(function* ({
	rules,
	ruleContext,
}: {
	readonly rules: readonly OutcomeRuleSchema.Type[];
	readonly ruleContext?: ItemDetailOutcomeRuleContext;
}) {
	if (ruleContext === undefined) return [];
	return yield* outcomeRulesFx({
		origin: ruleContext.origin,
		rules,
	}).pipe(
		Effect.provideService(RuntimeFx, {
			read: Effect.succeed(ruleContext.runtime),
		}),
		Effect.map((results) =>
			results.flatMap((result, ruleIndex) => {
				const hint = rules[ruleIndex]?.hint;
				return result.type === "disable" && result.active && hint !== undefined
					? [
							hint,
						]
					: [];
			}),
		),
	);
});

const readItemDetailOutcomeEntriesFx = Effect.fn("readItemDetailOutcomeEntriesFx")(function* ({
	outcomes,
	ruleContext,
}: {
	readonly outcomes: readonly OutcomeSchema.Type[];
	readonly ruleContext?: ItemDetailOutcomeRuleContext;
}) {
	const outcome: (
		| ItemDetailLines.OutcomeItem
		| OutcomeProjection.Space
		| OutcomeProjection.Template
	)[] = [];
	const config = yield* GameConfigFx;
	for (const entry of outcomes) {
		const activeRuleHints = yield* readActiveRuleHintsFx({
			rules: entry.rules,
			ruleContext,
		});
		outcome.push(
			entry.type === "template"
				? {
						type: "template",
						templateUid: entry.templateUid,
						title: config.templates?.find(
							(template) => template.uid === entry.templateUid,
						)?.title,
						activeRuleHints,
					}
				: entry.type === "space"
					? {
							type: "space",
							space: entry.space,
							activeRuleHints,
						}
					: {
							type: "item",
							itemUid: entry.itemUid,
							quantity: entry.quantity,
							activeRuleHints,
						},
		);
	}
	return outcome;
});

const readItemDetailOutcomeRollFx = Effect.fn("readItemDetailOutcomeRollFx")(function* ({
	roll,
	ruleContext,
}: {
	readonly roll: RollSchema.Type;
	readonly ruleContext?: ItemDetailOutcomeRuleContext;
}) {
	return yield* match(roll)
		.with(
			{
				type: RollTypeSchema.enum.Guaranteed,
			},
			({ outcome }) =>
				Effect.gen(function* () {
					return {
						kind: "guaranteed",
						outcome: yield* readItemDetailOutcomeEntriesFx({
							outcomes: outcome,
							ruleContext,
						}),
					} satisfies OutcomeProjection.Roll<ItemDetailLines.OutcomeItem>;
				}),
		)
		.with(
			{
				type: RollTypeSchema.enum.Chance,
			},
			({ chance, outcome }) =>
				Effect.gen(function* () {
					return {
						kind: "chance",
						chance,
						outcome: yield* readItemDetailOutcomeEntriesFx({
							outcomes: outcome,
							ruleContext,
						}),
					} satisfies OutcomeProjection.Roll<ItemDetailLines.OutcomeItem>;
				}),
		)
		.exhaustive();
});

/** Projects one line's authored outcome sets without flattening roll or probability semantics. */
export const readItemDetailOutcomeFx = Effect.fn("readItemDetailOutcomeFx")(function* ({
	line,
	ruleContext,
}: {
	readonly line: LineSchema.Type;
	readonly ruleContext?: ItemDetailOutcomeRuleContext;
}) {
	const outcome: OutcomeProjection.Set<ItemDetailLines.OutcomeItem>[] = [];
	for (const set of line.outcome?.set ?? []) {
		const roll: OutcomeProjection.Roll<ItemDetailLines.OutcomeItem>[] = [];
		for (const configuredRoll of set.roll) {
			roll.push(
				yield* readItemDetailOutcomeRollFx({
					roll: configuredRoll,
					ruleContext,
				}),
			);
		}
		outcome.push({
			activeRuleHints: yield* readActiveRuleHintsFx({
				rules: set.rules,
				ruleContext,
			}),
			weight: set.weight,
			roll,
		});
	}
	return outcome;
});
