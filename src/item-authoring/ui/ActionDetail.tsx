import { MousePointerClick } from "lucide-react";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { DisabledCapabilityDetail } from "~/item-authoring/ui/DisabledCapabilityDetail";
import { RulesDetail } from "~/item-authoring/ui/RulesDetail";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { DetailFact, DetailFacts, DetailSection } from "~/item-authoring/ui/DetailDefinition";
import { ProductionLineInputs } from "~/item-authoring/ui/ProductionLineInputs";
import { useTranslator } from "~/translation/ui/useTranslator";
import { Mx } from "~/translation/ui/Mx";

/** Presents an optional immediate action and its requirements. */
export const ActionDetail = ({
	item,
	preview = false,
}: {
	readonly item: ItemSchema.Type;
	readonly preview?: boolean;
}) => {
	const translator = useTranslator();
	const action = item.action;
	if (action === undefined) {
		const empty = (
			<DisabledCapabilityDetail
				capability="action"
				itemUid={item.uid}
				icon={MousePointerClick}
				title={translator.textFn(
					preview ? "Item action empty title" : "No action configured",
				)}
				summary={preview ? undefined : translator.textFn("Item action empty title")}
				size={preview ? "normal" : "large"}
				actionLabel={translator.textFn("Enable")}
			/>
		);
		return preview ? (
			<EditorRootCard dataUi="EditorActionDisabledCard">{empty}</EditorRootCard>
		) : (
			empty
		);
	}

	return (
		<EditorRootCard dataUi="EditorActionDetailCard">
			<DetailSection
				description={
					<Mx
						label={
							action.type === "space"
								? "Space action summary help"
								: "Inventory action summary help"
						}
					/>
				}
				title={translator.textFn(
					action.type === "space" ? "Space action" : "Inventory action",
				)}
			>
				{action.type === "space" ? (
					<DetailFacts>
						<DetailFact
							label={translator.textFn("Target space")}
							value={action.space}
						/>
					</DetailFacts>
				) : null}
			</DetailSection>
			<ProductionLineInputs
				emptyLabel={translator.textFn("No inputs")}
				input={action.input}
				title={translator.textFn("Requirements")}
			/>
			<RulesDetail rules={action.rules} />
		</EditorRootCard>
	);
};
