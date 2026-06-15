import type { FC } from "react";
import { useUpgradesSheetController } from "~/upgrade/hook/useUpgradesSheetController";
import { SheetHeader } from "~/shared/ui/SheetHeader";
import { UpgradeCard } from "~/upgrade/ui/UpgradeCard";

export namespace UpgradesSheet {
	export interface Props {
		onClose(): void;
	}
}

export const UpgradesSheet: FC<UpgradesSheet.Props> = ({ onClose }) => {
	const controller = useUpgradesSheetController();

	return (
		<div className="flex max-h-[var(--ak-sheet-max-height)] min-h-0 flex-col">
			<SheetHeader
				eyebrow="Upgrades"
				description="Game-wide bonuses bought with collected valuables"
				onClose={onClose}
			/>
			<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
				<div className="ak-game-width mx-auto grid gap-3">
					{controller.upgrades.map((upgrade) => (
						<UpgradeCard
							key={upgrade.id}
							upgrade={upgrade}
							items={controller.items}
							pending={controller.buyPending}
							onBuy={controller.buy}
						/>
					))}
				</div>
			</div>
		</div>
	);
};
