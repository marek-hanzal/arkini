import type { FC } from "react";
import { SheetHeader } from "~/v0/play/sheet/SheetHeader";
import { UpgradeCard } from "~/v0/upgrade/ui/UpgradeCard";
import { toGameActionError } from "~/v0/play/action/toGameActionError";
import {
	useGameAction,
	useGameItemCatalogView,
	useGameRuntimeStore,
	useGameUpgradeListView,
} from "~/v0/play/runtime";
import type { UpgradeId } from "~/v0/manifest/manifestId";

export namespace UpgradesSheet {
	export interface Props {
		onClose(): void;
	}
}

const inventoryInputRefsForUpgrade = ({
	store,
	upgradeId,
}: {
	store: ReturnType<typeof useGameRuntimeStore>;
	upgradeId: UpgradeId;
}) => {
	const snapshot = store.getSnapshot().runtime;
	const upgrade = snapshot.config.upgrades[upgradeId];
	const completed = snapshot.save.upgrades[upgradeId]?.completedTiers ?? 0;
	const runningJob = Object.values(snapshot.save.upgradeJobs).find(
		(job) => job.upgradeId === upgradeId,
	);
	const tier = upgrade?.tiers[runningJob?.tierIndex ?? completed];
	if (!tier) return [];

	return tier.cost.flatMap((cost) => {
		let remaining = cost.quantity;
		const refs: {
			kind: "inventory";
			quantity: number;
			slotIndex: number;
		}[] = [];

		for (const [slotIndex, slot] of snapshot.save.inventory.slots.entries()) {
			if (!slot || slot.itemId !== cost.itemId || remaining <= 0) continue;

			const quantity = Math.min(slot.quantity, remaining);
			refs.push({
				kind: "inventory",
				quantity,
				slotIndex,
			});
			remaining -= quantity;
		}

		return refs;
	});
};

export const UpgradesSheet: FC<UpgradesSheet.Props> = ({ onClose }) => {
	const upgrades = useGameUpgradeListView();
	const store = useGameRuntimeStore();
	const upgradeAction = useGameAction();
	const items = useGameItemCatalogView();
	const actionErrorMessage = upgradeAction.error
		? toGameActionError(upgradeAction.error).message
		: undefined;

	return (
		<div className="flex max-h-[var(--ak-sheet-max-height)] min-h-0 flex-col">
			<SheetHeader
				eyebrow="Upgrades"
				description="Game-wide bonuses bought with collected valuables"
				onClose={onClose}
			/>
			<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
				<div className="ak-game-width mx-auto grid gap-3">
					{actionErrorMessage ? (
						<div className="rounded-md border border-red-300/30 bg-red-950/35 px-3 py-2 text-xs font-semibold text-red-100">
							{actionErrorMessage}
						</div>
					) : null}
					{upgrades.upgrades.map((upgrade) => (
						<UpgradeCard
							key={upgrade.id}
							upgrade={upgrade}
							items={items}
							pending={upgradeAction.isPending}
							onBuy={(upgradeId) =>
								void upgradeAction.run({
									inputRefs: inventoryInputRefsForUpgrade({
										store,
										upgradeId,
									}),
									type: "upgrade.start",
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
