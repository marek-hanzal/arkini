import type { IdSchema } from "~/game-config/schema/IdSchema";
import type { StorageSchema } from "~/item-definition/schema/StorageSchema";
import type { TypeSchema } from "~/item-definition/schema/TypeSchema";
import { ItemStorageScopeLabel, ItemTypeLabel } from "~/item-definition/ui/ItemDefinitionLabels";
import { Fact, FactList } from "~/ui/ui/FactList";
import { Scrollable } from "~/ui/ui/Scrollable";

type ItemDefinitionDetail = {
	readonly itemId: IdSchema.Type;
	readonly title: string;
	readonly sourceUrl: string;
	readonly compositeUrl?: string;
	readonly description: string;
	readonly itemType: TypeSchema.Type;
	readonly storageScope: StorageSchema.Type;
	readonly maxStackSize: number;
	readonly ownedQuantity: number;
	readonly maxCount?: number;
	readonly totalCharges?: number;
};

/** Renders authored facts for a configured item reference without pretending a live stack exists. */
export const ItemDefinitionInfoTab = ({
	definition,
}: {
	readonly definition: ItemDefinitionDetail;
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
