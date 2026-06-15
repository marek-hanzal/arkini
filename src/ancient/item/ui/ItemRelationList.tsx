import type { FC } from "react";
import type { ItemId } from "~/manifest/manifestId";
import type { ItemCatalogView } from "~/item/view/ItemCatalogViewSchema";

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
		<div className="rounded-md border border-slate-800 bg-slate-950/50 p-3">
			<p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
				{title}
			</p>
			<div className="mt-2 space-y-2">
				{relations.map((relation) => (
					<div
						key={relation.key}
						className="rounded-sm bg-slate-900/70 px-2 py-1.5 text-xs text-slate-300"
					>
						{items[relation.leftItemId]?.name ?? relation.leftItemId} →{" "}
						{items[relation.resultItemId]?.name ?? relation.resultItemId}
					</div>
				))}
			</div>
		</div>
	);
};
