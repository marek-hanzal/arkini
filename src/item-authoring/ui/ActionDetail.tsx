import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { DetailFact, DetailFacts, DetailSection } from "~/item-authoring/ui/DetailDefinition";
import { ProductionLineInputs } from "~/item-authoring/ui/ProductionLineInputs";
import { useTranslator } from "~/translation/ui/useTranslator";

/** Presents an optional immediate action and its requirements. */
export const ActionDetail = ({ item }: { readonly item: ItemSchema.Type }) => {
	const translator = useTranslator();
	if (item.type !== "common") return null;
	const action = item.action;
	if (action === undefined)
		return (
			<DetailSection
				title={translator.textFn("Action")}
				description={translator.textFn(
					"No action configured. Enable an action in the Editor to give this item an immediate interaction.",
				)}
			>
				{null}
			</DetailSection>
		);
	return (
		<div className="grid gap-6">
			<DetailSection
				description={translator.textFn(
					"Activation settles every requirement before entering the target.",
				)}
				title={translator.textFn("Space action")}
			>
				<DetailFacts>
					<DetailFact
						label={translator.textFn("Target space")}
						value={action.space}
					/>
					<DetailFact
						label={translator.textFn("Rules")}
						value={action.rules.length}
					/>
				</DetailFacts>
			</DetailSection>
			<ProductionLineInputs
				emptyLabel={translator.textFn("No additional action requirements.")}
				input={action.input}
				title={translator.textFn("Requirements")}
			/>
		</div>
	);
};
