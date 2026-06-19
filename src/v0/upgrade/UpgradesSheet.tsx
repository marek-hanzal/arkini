import type { FC } from "react";
import { readGameSaveInventorySlotQuantity } from "~/v0/game/engine/model/GameSaveInventorySlot";
import { SheetHeader } from "~/v0/play/sheet/SheetHeader";
import { UpgradeCard } from "~/v0/upgrade/ui/UpgradeCard";
import { toGameActionError } from "~/v0/play/action/toGameActionError";
import { useLiveNowMs } from "~/v0/time/useLiveNowMs";
import {
	useGameAction,
	useGameItemCatalogView,
	useGameRuntimeSelector,
	useGameRuntimeStore,
	useGameUpgradeListView,
} from "~/v0/play/runtime";
import type { UpgradeId } from "~/v0/game/config/GameIdSchema";

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

			const quantity = Math.min(readGameSaveInventorySlotQuantity(slot), remaining);
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

const sameNumberArray = (left: readonly number[], right: readonly number[]) =>
	left.length === right.length && left.every((value, index) => value === right[index]);

export const UpgradesSheet: FC<UpgradesSheet.Props> = ({ onClose }) => {
	const upgradeReadyAtMs = useGameRuntimeSelector(
		(state) =>
			Object.values(state.runtime.save.upgradeJobs)
				.map((job) => job.completesAtMs)
				.sort((left, right) => left - right),
		sameNumberArray,
	);
	const nowMs = useLiveNowMs(upgradeReadyAtMs);
	const upgrades = useGameUpgradeListView(nowMs);
	const store = useGameRuntimeStore();
	const upgradeAction = useGameAction();
	const items = useGameItemCatalogView();
	const actionErrorMessage = upgradeAction.error
		? toGameActionError(upgradeAction.error).message
		: undefined;

	return (
		<div
			data-ui="upgrades sheet"
			className="flex max-h-[var(--ak-sheet-max-height)] min-h-0 w-full flex-col overflow-hidden bg-ak-surface"
		>
			<SheetHeader
				title="Upgrades"
				onClose={onClose}
			/>
			<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
				<div className="mx-auto grid w-full max-w-[460px] gap-3">
					{actionErrorMessage ? (
						<div className="rounded-sm border border-rose-400/70 bg-rose-950/60 px-3 py-2 text-sm font-semibold text-rose-100">
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
