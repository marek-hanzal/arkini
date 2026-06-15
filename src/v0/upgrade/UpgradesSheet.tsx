import { useSuspenseQuery } from "@tanstack/react-query";
import type { FC } from "react";
import { SheetHeader } from "~/v0/play/sheet/SheetHeader";
import { UpgradeCard } from "~/v0/upgrade/ui/UpgradeCard";
import { useBuyUpgradeMutation } from "~/v0/upgrade/action/useBuyUpgradeMutation";
import { itemCatalogQueryOptions } from "~/v0/item/query/itemCatalogQueryOptions";
import { upgradeListQueryOptions } from "~/v0/upgrade/query/upgradeListQueryOptions";

export namespace UpgradesSheet {
	export interface Props {
		onClose(): void;
	}
}

export const UpgradesSheet: FC<UpgradesSheet.Props> = ({ onClose }) => {
	const { data: upgrades } = useSuspenseQuery(upgradeListQueryOptions());
	const { data: items } = useSuspenseQuery(itemCatalogQueryOptions());
	const buyUpgradeMutation = useBuyUpgradeMutation();

	return (
		<div className="flex max-h-[var(--ak-sheet-max-height)] min-h-0 flex-col">
			<SheetHeader
				eyebrow="Upgrades"
				description="Game-wide bonuses bought with collected valuables"
				onClose={onClose}
			/>
			<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
				<div className="ak-game-width mx-auto grid gap-3">
					{upgrades.upgrades.map((upgrade) => (
						<UpgradeCard
							key={upgrade.id}
							upgrade={upgrade}
							items={items}
							pending={buyUpgradeMutation.isPending}
							onBuy={(upgradeId) =>
								buyUpgradeMutation.mutate({
									upgradeId,
								})
							}
						/>
					))}
				</div>
			</div>
		</div>
	);
};
