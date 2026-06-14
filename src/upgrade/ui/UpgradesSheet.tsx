import type { FC } from "react";
import { usePlayAction } from "~/play/hook/usePlayAction";
import { usePlayItems } from "~/play/hook/usePlayItems";
import { usePlayUpgrades } from "~/play/hook/usePlayUpgrades";
import { SheetHeader } from "~/shared/ui/SheetHeader";
import { UpgradeCard } from "~/upgrade/ui/UpgradeCard";

export namespace UpgradesSheet {
	export interface Props {
		onClose(): void;
	}
}

export const UpgradesSheet: FC<UpgradesSheet.Props> = ({ onClose }) => {
	const upgrades = usePlayUpgrades().data;
	const items = usePlayItems().data;
	const buyUpgrade = usePlayAction(
		(
			db,
			input: {
				upgradeId: string;
			},
		) => db.buyUpgrade(input.upgradeId),
		{
			invalidateTargets: [
				"board",
				"inventory",
				"upgrades",
				"databaseStatus",
			],
		},
	);

	return (
		<div className="flex max-h-[var(--ak-sheet-max-height)] min-h-0 flex-col">
			<SheetHeader
				eyebrow="Upgrades"
				description="Game-wide bonuses bought with collected valuables"
				onClose={onClose}
			/>
			<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
				<div className="ak-game-width mx-auto grid gap-3">
					{upgrades?.upgrades.map((upgrade) => (
						<UpgradeCard
							key={upgrade.id}
							upgrade={upgrade}
							items={items}
							pending={buyUpgrade.isPending}
							onBuy={(upgradeId) =>
								buyUpgrade.mutate({
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
