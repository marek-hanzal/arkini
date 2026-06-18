import type { FC } from "react";
import type { ItemId } from "~/v0/manifest/manifestId";
import type { ItemCatalogView } from "~/v0/item/view/ItemCatalogViewSchema";

export namespace ItemRelationList {
	export interface Relation {
		key: string;
		leftItemId: ItemId;
		resultItemId: ItemId;
	}

	export interface Props {
		title: string;
		items: ItemCatalogView;
		relations: Relation[];
	}
}

export const ItemRelationList: FC<ItemRelationList.Props> = ({ title, items, relations }) => {
	if (!relations.length) return null;

	return (
		<div className="ak-ui-card-soft p-3">
			<p className="ak-ui-eyebrow">{title}</p>
			<div className="mt-2 grid gap-1.5">
				{relations.map((relation) => (
					<div
						key={relation.key}
						className="ak-ui-row break-words px-2 py-1.5 text-xs text-ak-text"
					>
						{items[relation.leftItemId]?.name ?? relation.leftItemId} →{" "}
						{items[relation.resultItemId]?.name ?? relation.resultItemId}
					</div>
				))}
			</div>
		</div>
	);
};
