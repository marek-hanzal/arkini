import { ProductionLineOption } from "~/production-authoring/ui/ProductionLineOption";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorCollectionSelector } from "~/editor-control/ui/EditorCollectionSelector";
import { readCapabilityRelatedTermsFn } from "~/item-authoring/fn/readCapabilityRelatedTermsFn";
import { Factory } from "lucide-react";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { ProductionLineDetail } from "~/item-authoring/ui/ProductionLineDetail";
import { DisabledCapabilityDetail } from "~/item-authoring/ui/DisabledCapabilityDetail";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { useTranslator } from "~/translation/ui/useTranslator";

/** Presents the authored production lines and their input/outcome flows. */
export const ProductionDetail = ({ item }: { readonly item: ItemSchema.Type }) => {
	const translator = useTranslator();
	const project = useEditorProject();
	return (
		<div
			className="grid gap-[var(--ak-viewport-gap)]"
			data-ui="EditorItemProductionDetail"
		>
			{item.lines.length > 0 ? (
				<EditorCollectionSelector
					key={item.uid}
					count={item.lines.length}
					itemLabelFn={(index) => item.lines[index].title}
					renderItemContentFn={(index, label) => (
						<ProductionLineOption
							items={project.config.items}
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
						size="large"
					/>
				</EditorRootCard>
			)}
		</div>
	);
};
