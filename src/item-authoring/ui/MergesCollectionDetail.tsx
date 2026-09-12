import { Combine } from "lucide-react";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { EditorCollectionSelector } from "~/editor-control/ui/EditorCollectionSelector";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { readCapabilityRelatedTermsFn } from "~/item-authoring/fn/readCapabilityRelatedTermsFn";
import { MergeDetail } from "~/item-authoring/ui/CapabilityDetails";
import { DisabledCapabilityDetail } from "~/item-authoring/ui/DisabledCapabilityDetail";
import { ItemDetailSectionHeader } from "~/item-authoring/ui/ItemDetailSectionHeader";
import { useTranslator } from "~/translation/ui/useTranslator";

/** Shows all authored merges until the shared selector filters to one entry. */
export const MergesCollectionDetail = ({ item }: { readonly item: ItemSchema.Type }) => {
	const project = useEditorProject();
	const translator = useTranslator();
	const merges = item.merge ?? [];
	return (
		<div
			className="grid gap-[var(--ak-viewport-gap)]"
			data-ui="EditorItemMergesCollectionDetail"
		>
			<ItemDetailSectionHeader
				itemUid={item.uid}
				sectionId="merges"
				title={translator.textFn("Merges")}
				description={translator.textFn(
					"Dropping this item onto a matching target applies its source action, target effect and optional output.",
				)}
			/>
			{merges.length === 0 ? (
				<EditorRootCard dataUi="EditorItemMergesDisabledCard">
					<DisabledCapabilityDetail
						capability="merges"
						itemUid={item.uid}
						title={translator.textFn("Item merges empty title")}
						actionLabel={translator.textFn("Enable")}
						icon={Combine}
					/>
				</EditorRootCard>
			) : (
				<EditorCollectionSelector
					key={item.uid}
					count={merges.length}
					initialSelectedIndex={null}
					clearSelectionLabel={translator.textFn("Clear filter")}
					unselectedContent={merges.map((merge, index) => (
						<MergeDetail
							key={index}
							itemUid={item.uid}
							index={index}
							merge={merge}
						/>
					))}
					itemLabelFn={(index) => {
						const targetId = merges[index].target.itemId;
						return `${translator.textFn("Merge")} ${index + 1} — ${project.config.items[targetId]?.title || targetId}`;
					}}
					itemSearchTermsFn={(index) => [
						merges[index].target.itemId,
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
