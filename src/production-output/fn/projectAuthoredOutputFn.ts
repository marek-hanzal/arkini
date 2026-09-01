import type { OutputSchema } from "~/production-output/schema/OutputSchema";
import type { DropSchema } from "~/production-output/schema/DropSchema";
import type { OutputProjection } from "~/production-output/type/OutputProjection";

type ItemTitles = Readonly<
	Record<
		string,
		{
			readonly title: string;
		}
	>
>;

const projectDropFn = (
	drop: DropSchema.Type,
	items: ItemTitles,
): OutputProjection.AuthoredItem => ({
	activeRuleHints: [],
	itemId: drop.itemId,
	placement: drop.placement,
	quantity: drop.quantity,
	rules: drop.rules,
	title: items[drop.itemId]?.title ?? drop.itemId,
});

/** Projects canonical authored output into the shared visible output structure. */
export const projectAuthoredOutputFn = (
	output: OutputSchema.Type | undefined,
	items: ItemTitles,
): readonly OutputProjection.Set<OutputProjection.AuthoredItem>[] =>
	output?.set.map((set) => ({
		roll: set.roll.map((roll): OutputProjection.Roll<OutputProjection.AuthoredItem> => {
			if (roll.type === "weight")
				return {
					kind: "weight",
					option: roll.drop.map((option) => ({
						item: option.drop.map((drop) => projectDropFn(drop, items)),
						weight: option.weight,
					})),
					selections: roll.quantity,
				};
			return roll.type === "guaranteed"
				? {
						item: roll.drop.map((drop) => projectDropFn(drop, items)),
						kind: "guaranteed",
					}
				: {
						chance: roll.chance,
						item: roll.drop.map((drop) => projectDropFn(drop, items)),
						kind: "chance",
					};
		}),
		weight: set.weight,
	})) ?? [];
