import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { DropSchema } from "~/production-output/schema/DropSchema";
import type { OutputSchema } from "~/production-output/schema/OutputSchema";
import type { ReactNode } from "react";
import type { ItemDetailLinesProjection } from "~/item-line-detail/type/ItemDetailLinesProjection";
import { ItemLineOutputs } from "~/item-line-detail/ui/ItemLineOutputs";
import { EditorItemDetailReference } from "~/item-authoring/ui/EditorItemDetailReference";

type EditorItemRegistry = Record<string, ItemSchema.Type>;

const projectDrop = (
	drop: DropSchema.Type,
	items: EditorItemRegistry,
): ItemDetailLinesProjection.OutputItem => ({
	itemId: drop.itemId,
	quantity: drop.quantity,
	title: items[drop.itemId]?.title ?? drop.itemId,
	activeRuleHints: [],
});

const projectOutput = (
	output: OutputSchema.Type | undefined,
	items: EditorItemRegistry,
): readonly ItemDetailLinesProjection.OutputSet[] =>
	output?.set.map((set) => ({
		roll: set.roll.map((roll): ItemDetailLinesProjection.OutputRoll => {
			if (roll.type === "weight")
				return {
					kind: "weight",
					option: roll.drop.map((option) => ({
						item: option.drop.map((drop) => projectDrop(drop, items)),
						weight: option.weight,
					})),
					selections: roll.quantity,
				};
			return roll.type === "guaranteed"
				? {
						item: roll.drop.map((drop) => projectDrop(drop, items)),
						kind: "guaranteed",
					}
				: {
						chance: roll.chance,
						item: roll.drop.map((drop) => projectDrop(drop, items)),
						kind: "chance",
					};
		}),
		weight: set.weight,
	})) ?? [];

const renderOutputItem = (
	item: ItemDetailLinesProjection.OutputItem,
	items: EditorItemRegistry,
	projectId: string,
): ReactNode => {
	const definition = items[item.itemId];
	return definition === undefined ? (
		<span className="truncate font-medium text-foreground">{item.title}</span>
	) : (
		<EditorItemDetailReference
			item={definition}
			projectId={projectId}
		/>
	);
};

/** Projects authored output rolls into the canonical item-line output presentation. */
export const EditorProductionLineOutputs = ({
	items,
	output,
	projectId,
}: {
	readonly items: EditorItemRegistry;
	readonly output: OutputSchema.Type | undefined;
	readonly projectId: string;
}) => (
	<ItemLineOutputs
		disabled={false}
		output={projectOutput(output, items)}
		renderItem={(item) => renderOutputItem(item, items, projectId)}
	/>
);
