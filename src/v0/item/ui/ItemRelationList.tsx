import type { FC } from "react";
import type { ItemId } from "~/v0/manifest/manifestId";
import type { ItemCatalogView } from "~/v0/item/view/ItemCatalogViewSchema";
import { UiSection } from "~/v0/ui/UiSection";

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
		<UiSection title={title}>
			<div className="grid gap-1.5">
				{relations.map((relation) => (
					<div
						key={relation.key}
						className="rounded-sm bg-ak-surface px-2.5 py-2 text-sm text-ak-text-muted"
					>
						<span className="text-ak-text">
							{items[relation.leftItemId]?.name ?? relation.leftItemId}
						</span>{" "}
						→{" "}
						<span className="text-ak-text">
							{items[relation.resultItemId]?.name ?? relation.resultItemId}
						</span>
					</div>
				))}
			</div>
		</UiSection>
	);
};
