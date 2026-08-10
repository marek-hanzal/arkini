import type { ReactNode } from "react";

import type { EditorDrop, EditorItem, EditorOutput } from "~/bridge/item/editor/EditorItemModel";
import type { ItemDetailLines } from "~/bridge/item-detail/ItemDetailLines";
import { ItemLineOutputs } from "~/ui/item-detail/ItemLineOutputs";
import { EditorItemDetailReference } from "~/ui/item/editor/EditorItemDetailReference";

type EditorItemRegistry = Record<string, EditorItem>;

const projectDrop = (drop: EditorDrop, items: EditorItemRegistry): ItemDetailLines.OutputItem => ({
	itemId: drop.itemId,
	quantity: drop.quantity,
	title: items[drop.itemId]?.title ?? drop.itemId,
	activeRuleHints: [],
});

const projectOutput = (
	output: EditorOutput | undefined,
	items: EditorItemRegistry,
): readonly ItemDetailLines.OutputSet[] =>
	output?.set.map((set) => ({
		roll: set.roll.map((roll): ItemDetailLines.OutputRoll => {
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
	item: ItemDetailLines.OutputItem,
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
	readonly output: EditorOutput | undefined;
	readonly projectId: string;
}) => (
	<ItemLineOutputs
		disabled={false}
		output={projectOutput(output, items)}
		renderItem={(item) => renderOutputItem(item, items, projectId)}
	/>
);
