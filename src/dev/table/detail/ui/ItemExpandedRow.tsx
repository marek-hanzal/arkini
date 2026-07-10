import type { FC } from "react";

import type { ItemSchema } from "~/v1/item/schema/ItemSchema";
import { CodePill, DetailField, DetailSection } from "./DetailPrimitives";
import { ItemAssetPanel } from "./ItemAssetPanel";
import { ItemTypeDetails } from "./ItemTypeDetails";
import { MergeDetails } from "./MergeDetails";

export namespace ItemExpandedRow {
	export interface Props {
		item: ItemSchema.Type;
	}
}

export const ItemExpandedRow: FC<ItemExpandedRow.Props> = ({ item }) => (
	<div className="space-y-4 p-4 sm:p-5">
		<div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
			<DetailSection
				title="Shared item fields"
				description="These values come directly from BaseItemSchema."
			>
				<p className="text-sm leading-6 text-slate-300">{item.description}</p>
				<dl className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
					<DetailField
						label="ID"
						value={<CodePill tone="violet">{item.id}</CodePill>}
					/>
					<DetailField
						label="Type"
						value={<CodePill>{item.type}</CodePill>}
					/>
					<DetailField
						label="Category"
						value={<CodePill>{item.categoryId}</CodePill>}
					/>
					<DetailField
						label="Scope"
						value={<CodePill>{item.scope}</CodePill>}
					/>
					<DetailField
						label="Max stack"
						value={item.maxStackSize.toLocaleString()}
					/>
					<DetailField
						label="Max owned"
						value={item.maxCount?.toLocaleString() ?? "Unlimited"}
					/>
				</dl>
				<div className="mt-4 flex flex-wrap gap-2">
					{item.tags.map((tag) => (
						<CodePill
							key={tag}
							tone="amber"
						>
							{tag}
						</CodePill>
					))}
				</div>
			</DetailSection>

			<DetailSection
				title="Packed assets"
				description="Asset IDs are resolved against the binary resources from the uploaded pack."
			>
				<ItemAssetPanel asset={item.asset} />
			</DetailSection>
		</div>

		<ItemTypeDetails item={item} />

		{item.merge ? (
			<DetailSection
				title={`Directional merges · ${item.merge.length}`}
				description="Rules initiated when this source item is dropped onto a matching target."
			>
				<div className="space-y-3">
					{item.merge.map((merge, index) => (
						<MergeDetails
							key={`${merge.effect}-${index}`}
							merge={merge}
							index={index}
						/>
					))}
				</div>
			</DetailSection>
		) : null}
	</div>
);
