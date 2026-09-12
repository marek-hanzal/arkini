import { MousePointerClick } from "lucide-react";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { DisabledCapabilityDetail } from "~/item-authoring/ui/DisabledCapabilityDetail";
import { RulesDetail } from "~/item-authoring/ui/RulesDetail";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { DetailFact, DetailFacts, DetailSection } from "~/item-authoring/ui/DetailDefinition";
import { ProductionLineInputs } from "~/item-authoring/ui/ProductionLineInputs";
import { useTranslator } from "~/translation/ui/useTranslator";

/** Presents an optional immediate action and its requirements. */
export const ActionDetail = ({ item }: { readonly item: ItemSchema.Type }) => {
	const translator = useTranslator();
	const action = item.action;
	if (action === undefined)
		return (
			<EditorRootCard dataUi="EditorActionDisabledCard">
				<DisabledCapabilityDetail
					capability="action"
					itemUid={item.uid}
					icon={MousePointerClick}
					title={translator.textFn("Action is disabled")}
					actionLabel={translator.textFn("Enable action")}
					description={translator.textFn(
						"An action activates immediately when the player uses this item. Enabling an action removes all production lines and the clock.",
					)}
				/>
			</EditorRootCard>
		);
	return (
		<EditorRootCard dataUi="EditorActionDetailCard">
			<DetailSection
				description={translator.textFn(
					action.type === "space"
						? "Activation settles every requirement before entering the target."
						: "Open the inventory after all requirements and rules pass.",
				)}
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
			<RulesDetail
				rules={action.rules}
				description={translator.textFn(
					"Every condition of a rule must pass. Every Enable rule gates activation; a matching Disable rule vetoes it. Requirements settle before the action opens its destination.",
				)}
			/>
		</EditorRootCard>
	);
};
