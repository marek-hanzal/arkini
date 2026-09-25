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
import { LineTriggerEnumSchema } from "~/production-line/schema/LineTriggerEnumSchema";

/** Presents the authored production lines and their input/outcome flows. */
export const ProductionDetail = ({
	item,
	kind = "manual",
}: {
	readonly item: ItemSchema.Type;
	readonly kind?: "manual" | "automation";
}) => {
	const translator = useTranslator();
	const project = useEditorProject();
	const lines = item.lines.filter((line) =>
		kind === "manual"
			? line.trigger === LineTriggerEnumSchema.enum.manual
			: line.trigger !== LineTriggerEnumSchema.enum.manual,
	);
	if (kind !== "manual" && lines.length === 0) return null;
	return (
		<div
			className="grid gap-[var(--ak-viewport-gap)]"
			data-ui="EditorItemProductionDetail"
		>
			{lines.length > 0 ? (
				<EditorCollectionSelector
					key={item.uid}
					count={lines.length}
					itemLabelFn={(index) => lines[index].title}
					renderItemContentFn={(index, label) => (
						<ProductionLineOption
							items={project.config.items}
							line={lines[index]}
							label={label}
						/>
					)}
					itemSearchTermsFn={(index) => [
						lines[index].uid,
						lines[index].description ?? "",
					]}
					itemRelatedSearchTermsFn={(index) =>
						readCapabilityRelatedTermsFn(lines[index], project.config.items)
					}
					label={translator.textFn(
						kind === "manual" ? "Product lines" : "Automation lines",
					)}
					navigationCard
				>
					{(index) => (
						<ProductionLineDetail
							itemUid={item.uid}
							line={lines[index]}
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
