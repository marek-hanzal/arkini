import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { DetailFact, DetailFacts, DetailSection } from "~/item-authoring/ui/DetailDefinition";
import { ProductionLineInputs } from "~/item-authoring/ui/ProductionLineInputs";

/** Presents the authored Space target and immediate action requirements. */
export const SpaceActionDetail = ({ item }: { readonly item: ItemSchema.Type }) => {
	if (item.type !== "space") return null;
	return (
		<div className="grid gap-6">
			<DetailSection
				description="Activation settles every requirement before entering the target."
				title="Space action"
			>
				<DetailFacts>
					<DetailFact
						label="Target space"
						value={item.space}
					/>
					<DetailFact
						label="Availability"
						value={item.enable ? "Enabled" : "Disabled"}
					/>
					<DetailFact
						label="Rules"
						value={item.rules.length}
					/>
				</DetailFacts>
			</DetailSection>
			<ProductionLineInputs
				emptyLabel="No additional action requirements."
				input={item.input}
				title="Requirements"
			/>
		</div>
	);
};
