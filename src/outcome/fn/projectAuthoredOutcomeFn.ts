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
	outcome.type === "template"
		? {
				type: "template",
				templateUid: outcome.templateUid,
				title: templates.find((template) => template.uid === outcome.templateUid)?.title,
				rules: outcome.rules,
				activeRuleHints: [],
			}
		: outcome.type === "space"
			? {
					type: "space",
					space: outcome.space,
					rules: outcome.rules,
					activeRuleHints: [],
				}
			: {
					type: "item",
					activeRuleHints: [],
					itemId: outcome.itemId,
					placement: outcome.placement,
					quantity: outcome.quantity,
					rules: outcome.rules,
					title: items[outcome.itemId]?.title ?? outcome.itemId,
				};

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
			return roll.type === "guaranteed"
				? {
						outcome: roll.outcome.map((outcome) =>
							projectOutcomeFn(outcome, items, templates),
						),
						kind: "guaranteed",
					}
				: {
						chance: roll.chance,
						outcome: roll.outcome.map((outcome) =>
							projectOutcomeFn(outcome, items, templates),
						),
						kind: "chance",
					};
		}),
		weight: set.weight,
	})) ?? [];
