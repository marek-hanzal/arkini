import type { FC } from "react";
import type { ItemId } from "~/v0/game/config/GameIdSchema";
import { ItemInlineAsset } from "~/v0/item/ui/ItemInlineAsset";
import type { ItemCatalogView } from "~/v0/item/view/ItemCatalogViewSchema";
import { UiSection } from "~/v0/ui/UiSection";

interface ItemRelation {
	key: string;
	leftItemId: ItemId;
	resultItemId: ItemId;
}

export namespace ItemRelationList {
	export interface Props {
		title: string;
		items: ItemCatalogView;
		relations: ItemRelation[];
	}
}

export const ItemRelationList: FC<ItemRelationList.Props> = ({ title, items, relations }) => {
	if (!relations.length) return null;

	return (
		<UiSection title={title}>
			<div className="grid gap-1.5">
				{relations.map((relation) => {
					const leftItem = items[relation.leftItemId];
					const resultItem = items[relation.resultItemId];
					return (
						<div
							key={relation.key}
							className="flex min-w-0 items-center gap-2 rounded-sm bg-ak-surface px-2.5 py-2 text-sm text-ak-text-muted"
						>
							<ItemInlineAsset
								item={leftItem}
								className="h-8 w-8"
							/>
							<div className="min-w-0 flex-1">
								<p className="break-words text-ak-text">
									{leftItem?.name ?? relation.leftItemId}
								</p>
							</div>
							<span className="shrink-0 text-ak-text-muted">→</span>
							<ItemInlineAsset
								item={resultItem}
								className="h-8 w-8"
							/>
							<div className="min-w-0 flex-1">
								<p className="break-words text-ak-text">
									{resultItem?.name ?? relation.resultItemId}
								</p>
							</div>
						</div>
					);
				})}
			</div>
		</UiSection>
	);
};
