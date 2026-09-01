import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { ItemStorageScopeLabel } from "~/item-definition/ui/ItemDefinitionLabels";
import { TypePresentation } from "~/item-definition/ui/TypePresentation";
import { Fact, FactList } from "~/ui/ui/FactList";

/** Presents the authored identity and storage contract of one item. */
export const IdentityDetail = ({ item }: { readonly item: ItemSchema.Type }) => (
	<div className="grid gap-x-8 gap-y-3 min-[64rem]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
		<FactList>
			<Fact
				label="Type"
				value={<TypePresentation type={item.type} />}
			/>
			<Fact
				label="Storage"
				value={ItemStorageScopeLabel[item.scope]}
			/>
			<Fact
				label="Stack capacity"
				value={item.maxStackSize === 1 ? "Single item" : `${item.maxStackSize} items`}
			/>
			<Fact
				label="Game limit"
				value={item.maxCount === undefined ? "No configured limit" : item.maxCount}
			/>
			<Fact
				label="Item ID"
				mono
				value={item.id}
			/>
			<Fact
				label="UID"
				mono
				value={item.uid}
			/>
		</FactList>
		<div className="self-start">
			<FactList columns={1}>
				<Fact
					label="Description"
					value={item.description || "No player-facing description."}
				/>
			</FactList>
		</div>
	</div>
);
