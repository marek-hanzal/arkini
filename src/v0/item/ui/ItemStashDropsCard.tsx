import type { FC } from "react";
import type { ActivationDropView } from "~/v0/board/view/ActivationDropViewSchema";
import { ItemInlineAsset } from "~/v0/item/ui/ItemInlineAsset";
import type { ItemCatalogView } from "~/v0/item/view/ItemCatalogViewSchema";
import { UiSection } from "~/v0/ui/UiSection";

export namespace ItemStashDropsCard {
	export interface Props {
		drops?: readonly ActivationDropView[];
		items: ItemCatalogView;
	}
}

export const ItemStashDropsCard: FC<ItemStashDropsCard.Props> = ({ drops = [], items }) => {
	if (drops.length === 0) return null;

	return (
		<UiSection title="Drops">
			<div className="grid gap-1.5">
				{drops.map((drop, index) => {
					const item = items[drop.itemId];
					return (
						<div
							key={`${index}:${drop.itemId}:${drop.chanceLabel}`}
							className="flex min-w-0 items-center gap-2 rounded-sm bg-ak-surface px-2.5 py-2 text-sm"
						>
							<ItemInlineAsset
								item={item}
								className="h-9 w-9"
							/>
							<div className="min-w-0 flex-1">
								<p className="break-words font-semibold text-ak-text">
									{item?.name ?? drop.itemId}
								</p>
								<p className="mt-0.5 break-words text-xs leading-5 text-ak-text-muted">
									{drop.rollLabel ? `${drop.rollLabel} · ` : ""}qty{" "}
									{drop.quantityLabel}
								</p>
							</div>
							<span className="shrink-0 rounded-sm bg-ak-primary/15 px-2 py-1 text-xs font-extrabold text-ak-primary">
								{drop.chanceLabel}
							</span>
						</div>
					);
				})}
			</div>
		</UiSection>
	);
};
