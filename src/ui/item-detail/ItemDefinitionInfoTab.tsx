import type { useItemDefinitionDetail } from "~/ui/item-detail/useItemDefinitionDetail";
import { ItemStorageScopeLabel, ItemTypeLabel } from "~/item-definition/ItemDefinitionLabels";
import { Fact, FactList } from "~/ui/fact/FactList";
import { Scrollable } from "~/ui/scrollable/Scrollable";

/** Renders authored facts for a configured item reference without pretending a live stack exists. */
export const ItemDefinitionInfoTab = ({
	definition,
}: {
	readonly definition: Extract<
		useItemDefinitionDetail.Projection,
		{
			readonly kind: "available";
		}
	>;
}) => {
	return (
		<Scrollable
			className="h-full pr-1"
			data-ui="ItemDefinitionInfoTab"
		>
			<section className="pb-5">
				<p className="max-w-4xl text-pretty text-base leading-relaxed text-muted">
					{definition.description}
				</p>
			</section>
			<section className="border-t border-line pt-2">
				<FactList>
					<Fact
						label="Type"
						value={ItemTypeLabel[definition.itemType]}
					/>
					<Fact
						label="Storage"
						value={ItemStorageScopeLabel[definition.storageScope]}
					/>
					<Fact
						label="Stack capacity"
						value={
							definition.maxStackSize === 1
								? "Single item"
								: `${definition.maxStackSize} items`
						}
					/>
					<Fact
						label="Owned"
						value={`${definition.ownedQuantity}${definition.maxCount === undefined ? "" : ` / ${definition.maxCount}`}`}
					/>
					<Fact
						label="Game limit"
						value={
							definition.maxCount === undefined
								? "No configured limit"
								: `${definition.maxCount}`
						}
					/>
					{definition.totalCharges === undefined ? null : (
						<Fact
							label="Charges per item"
							value={`${definition.totalCharges}`}
						/>
					)}
				</FactList>
			</section>
		</Scrollable>
	);
};
