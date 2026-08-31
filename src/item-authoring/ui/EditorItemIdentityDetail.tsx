import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { ItemStorageScopeLabel, ItemTypeLabel } from "~/item-definition/ui/ItemDefinitionLabels";
import { Fact, FactList } from "~/ui/fact/FactList";

/** Presents the authored identity and storage contract of one item. */
export const EditorItemIdentityDetail = ({ item }: { readonly item: ItemSchema.Type }) => (
	<div>
		<section className="pb-5">
			<p className="max-w-4xl text-pretty text-base leading-relaxed text-muted">
				{item.description || "No player-facing description."}
			</p>
		</section>
		<section className="border-t border-line pt-2">
			<FactList>
				<Fact
					label="Type"
					value={ItemTypeLabel[item.type]}
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
		</section>
	</div>
);
