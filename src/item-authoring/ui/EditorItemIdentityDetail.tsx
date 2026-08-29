import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import {
	ItemInfoFact,
	ItemInfoFacts,
	ItemStorageScopeLabel,
	ItemTypeLabel,
} from "~/ui/item-detail/ItemInfoPresentation";

/** Presents the authored identity and storage contract of one item. */
export const EditorItemIdentityDetail = ({ item }: { readonly item: ItemSchema.Type }) => (
	<div>
		<section className="pb-5">
			<p className="max-w-4xl text-pretty text-base leading-relaxed text-muted">
				{item.description || "No player-facing description."}
			</p>
		</section>
		<section className="border-t border-line pt-2">
			<ItemInfoFacts>
				<ItemInfoFact
					label="Type"
					value={ItemTypeLabel[item.type]}
				/>
				<ItemInfoFact
					label="Storage"
					value={ItemStorageScopeLabel[item.scope]}
				/>
				<ItemInfoFact
					label="Stack capacity"
					value={item.maxStackSize === 1 ? "Single item" : `${item.maxStackSize} items`}
				/>
				<ItemInfoFact
					label="Game limit"
					value={item.maxCount === undefined ? "No configured limit" : item.maxCount}
				/>
				<ItemInfoFact
					label="Item ID"
					mono
					value={item.id}
				/>
				<ItemInfoFact
					label="UID"
					mono
					value={item.uid}
				/>
			</ItemInfoFacts>
		</section>
	</div>
);
