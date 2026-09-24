import { MergeOption } from "~/item-authoring/ui/MergeOption";
import { Combine } from "lucide-react";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorCollectionSelector } from "~/editor-control/ui/EditorCollectionSelector";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { readCapabilityRelatedTermsFn } from "~/item-authoring/fn/readCapabilityRelatedTermsFn";
import { MergeDetail } from "~/item-authoring/ui/CapabilityDetails";
import { DisabledCapabilityDetail } from "~/item-authoring/ui/DisabledCapabilityDetail";
import { useTranslator } from "~/translation/ui/useTranslator";

/** Shows one authored merge selected from the complete collection. */
export const MergesCollectionDetail = ({ item }: { readonly item: ItemSchema.Type }) => {
	const project = useEditorProject();
	const translator = useTranslator();
	const merges = item.merge ?? [];
	return (
		<div
			className="grid gap-[var(--ak-viewport-gap)]"
			data-ui="EditorItemMergesCollectionDetail"
		>
			{merges.length === 0 ? (
				<DisabledCapabilityDetail
					capability="merges"
					itemUid={item.uid}
					title={translator.textFn("No merges for this item")}
					summary={translator.textFn("Item merges empty title")}
					size="large"
					actionLabel={translator.textFn("Enable")}
					icon={Combine}
				/>
			) : (
				<EditorCollectionSelector
					key={item.uid}
					count={merges.length}
					itemLabelFn={(index) => {
						const merge = merges[index];
						if (merge.action === "space")
							return merge.space === "previous"
								? translator.textFn("Previous Space")
								: `${translator.textFn("Space")} ${merge.space}`;
						const targetId = merge.target.itemUid;
						return `${translator.textFn("Merge")} ${index + 1} — ${project.config.items[targetId]?.title || targetId}`;
					}}
					renderItemContentFn={(index, label) => (
						<MergeOption
							label={label}
							merge={merges[index]}
							items={project.config.items}
						/>
					)}
					itemSearchTermsFn={(index) => [
						"target" in merges[index]
							? merges[index].target.itemUid
							: String(merges[index].space),
						merges[index].action,
						merges[index].effect,
					]}
					itemRelatedSearchTermsFn={(index) =>
						readCapabilityRelatedTermsFn(merges[index], project.config.items)
					}
					label={translator.textFn("Merges")}
					navigationCard
				>
					{(index) => (
						<MergeDetail
							itemUid={item.uid}
							index={index}
							merge={merges[index]}
						/>
					)}
				</EditorCollectionSelector>
			)}
		</div>
	);
};
