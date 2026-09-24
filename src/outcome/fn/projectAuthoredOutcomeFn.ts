import { match } from "ts-pattern";

import type { TemplateSchema } from "~/board-template/schema/TemplateSchema";
import type { OutcomeTableSchema } from "~/outcome/schema/OutcomeTableSchema";
import type { OutcomeSchema } from "~/outcome/schema/OutcomeSchema";
import type { OutcomeProjection } from "~/outcome/type/OutcomeProjection";

type ItemTitles = Readonly<
	Record<
		string,
		{
			readonly title: string;
		}
	>
>;

const projectOutcomeFn = (
	outcome: OutcomeSchema.Type,
	items: ItemTitles,
	templates: readonly TemplateSchema.Type[] = [],
): OutcomeProjection.AuthoredItem | OutcomeProjection.Space | OutcomeProjection.Template =>
	match(outcome)
		.returnType<
			OutcomeProjection.AuthoredItem | OutcomeProjection.Space | OutcomeProjection.Template
		>()
		.with(
			{
				type: "template",
			},
			(outcome) => ({
				type: "template",
				templateUid: outcome.templateUid,
				title: templates.find((template) => template.uid === outcome.templateUid)?.title,
				rules: outcome.rules,
				activeRuleHints: [],
			}),
		)
		.with(
			{
				type: "space",
			},
			(outcome) => ({
				type: "space",
				space: outcome.space,
				rules: outcome.rules,
				activeRuleHints: [],
			}),
		)
		.with(
			{
				type: "item",
			},
			(outcome) => ({
				type: "item",
				activeRuleHints: [],
				itemUid: outcome.itemUid,
				placement: outcome.placement,
				quantity: outcome.quantity,
				rules: outcome.rules,
				title: items[outcome.itemUid]?.title ?? outcome.itemUid,
			}),
		)
		.exhaustive();

/** Projects canonical authored table into the shared visible table structure. */
export const projectAuthoredOutcomeFn = (
	table: OutcomeTableSchema.Type | undefined,
	items: ItemTitles,
	templates: readonly TemplateSchema.Type[] = [],
): readonly OutcomeProjection.Set<OutcomeProjection.AuthoredItem>[] =>
	table?.set.map((set) => ({
		activeRuleHints: [],
		rules: set.rules,
		roll: set.roll.map((roll): OutcomeProjection.Roll<OutcomeProjection.AuthoredItem> => {
			const outcome = roll.outcome.map((outcome) =>
				projectOutcomeFn(outcome, items, templates),
			);
			return match(roll)
				.returnType<OutcomeProjection.Roll<OutcomeProjection.AuthoredItem>>()
				.with(
					{
						type: "guaranteed",
					},
					() => ({
						outcome,
						kind: "guaranteed",
					}),
				)
				.with(
					{
						type: "chance",
					},
					(roll) => ({
						chance: roll.chance,
						outcome,
						kind: "chance",
					}),
				)
				.exhaustive();
		}),
		weight: set.weight,
	})) ?? [];
