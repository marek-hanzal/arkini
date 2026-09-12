import { ProductionLineOption } from "~/production-authoring/ui/ProductionLineOption";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorCollectionSelector } from "~/editor-control/ui/EditorCollectionSelector";
import { readCapabilityRelatedTermsFn } from "~/item-authoring/fn/readCapabilityRelatedTermsFn";
import { Factory } from "lucide-react";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { ProductionLineDetail } from "~/item-authoring/ui/ProductionLineDetail";
import { DisabledCapabilityDetail } from "~/item-authoring/ui/DisabledCapabilityDetail";
import { ItemDetailSectionHeader } from "~/item-authoring/ui/ItemDetailSectionHeader";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { useTranslator } from "~/translation/ui/useTranslator";

/** Presents the authored production lines and their input/output flows. */
export const ProductionDetail = ({ item }: { readonly item: ItemSchema.Type }) => {
	const translator = useTranslator();
	const project = useEditorProject();
	return (
		<div
			className="grid gap-[var(--ak-viewport-gap)]"
			data-ui="EditorItemProductionDetail"
		>
			<ItemDetailSectionHeader
				itemUid={item.uid}
				sectionId="production"
				title={translator.textFn("Production lines")}
				description={translator.textFn(
					"Each line owns its inputs, outputs, runtime and rules. Manual and Clock requests share the same queue.",
				)}
			/>
			{item.lines.length > 0 ? (
				<EditorCollectionSelector
					key={item.uid}
					count={item.lines.length}
					clearSelectionLabel={translator.textFn("Clear filter")}
					unselectedContent={item.lines.map((line) => (
						<ProductionLineDetail
							key={line.id}
							itemUid={item.uid}
							line={line}
						/>
					))}
					itemLabelFn={(index) => item.lines[index].title}
					renderItemContentFn={(index, label) => (
						<ProductionLineOption
							line={item.lines[index]}
							label={label}
						/>
					)}
					itemSearchTermsFn={(index) => [
						item.lines[index].id,
						item.lines[index].description,
					]}
					itemRelatedSearchTermsFn={(index) =>
						readCapabilityRelatedTermsFn(item.lines[index], project.config.items)
					}
					label={translator.textFn("Product lines")}
					navigationCard
				>
					{(index) => (
						<ProductionLineDetail
							itemUid={item.uid}
							line={item.lines[index]}
						/>
					)}
				</EditorCollectionSelector>
			) : (
				<EditorRootCard dataUi="EditorProductionDisabledCard">
					<DisabledCapabilityDetail
						capability="production"
						itemUid={item.uid}
						title={translator.textFn("Item production empty title")}
						actionLabel={translator.textFn("Enable")}
						icon={Factory}
					/>
				</EditorRootCard>
			)}
		</div>
	);
};
