import type { FC } from "react";
import type { ActivationDropView } from "~/v0/board/view/ActivationDropViewSchema";
import { ItemInlineAsset } from "~/v0/item/ui/ItemInlineAsset";
import type { ItemCatalogView } from "~/v0/item/view/ItemCatalogViewSchema";
import { DetailCard, DetailMutedPill } from "~/v0/item-detail/ui/DetailCard";

export namespace DetailDropsPanel {
	export interface Props {
		drops?: readonly ActivationDropView[];
		items: ItemCatalogView;
	}
}

type DropGroup = {
	label: string;
	drops: readonly ActivationDropView[];
};

const readDropGroups = (drops: readonly ActivationDropView[]): DropGroup[] =>
	[
		{
			drops: drops.filter((drop) => drop.chanceLabel === "100%"),
			label: "Guaranteed",
		},
		{
			drops: drops.filter((drop) => drop.chanceLabel !== "100%"),
			label: "Chance drops",
		},
	].filter((group) => group.drops.length > 0);

const readDropMeta = (drop: ActivationDropView) =>
	[
		drop.rollLabel,
		`Quantity ${drop.quantityLabel}`,
	]
		.filter(Boolean)
		.join(" · ");

export const DetailDropsPanel: FC<DetailDropsPanel.Props> = ({ drops = [], items }) => {
	const groups = readDropGroups(drops);
	if (groups.length === 0) return null;

	return (
		<DetailCard
			eyebrow="Loot"
			title="Possible drops"
			action={<DetailMutedPill>{drops.length}</DetailMutedPill>}
		>
			<div className="grid gap-3">
				{groups.map((group) => (
					<section
						key={group.label}
						className="grid gap-2"
					>
						<div className="flex items-center justify-between gap-2">
							<p className="text-xs font-black uppercase tracking-[0.22em] text-ak-text-muted">
								{group.label}
							</p>
							<DetailMutedPill>{group.drops.length}</DetailMutedPill>
						</div>
						<div className="grid gap-2">
							{group.drops.map((drop, index) => {
								const item = items[drop.itemId];
								return (
									<article
										key={`${group.label}:${index}:${drop.itemId}:${drop.chanceLabel}`}
										className="flex min-w-0 items-center gap-2 rounded-sm bg-ak-surface/80 px-2.5 py-2 text-sm"
									>
										<ItemInlineAsset
											item={item}
											className="h-9 w-9"
										/>
										<div className="min-w-0 flex-1">
											<p className="break-words font-black text-ak-text">
												{item?.name ?? drop.itemId}
											</p>
											<p className="mt-0.5 break-words text-xs leading-5 text-ak-text-muted">
												{readDropMeta(drop)}
											</p>
										</div>
										<DetailMutedPill>{drop.chanceLabel}</DetailMutedPill>
									</article>
								);
							})}
						</div>
					</section>
				))}
			</div>
		</DetailCard>
	);
};
