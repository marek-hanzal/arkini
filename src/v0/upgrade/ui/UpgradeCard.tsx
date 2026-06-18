import type { FC } from "react";
import type { UpgradeId } from "~/v0/manifest/manifestId";
import type { ItemCatalogView } from "~/v0/item/view/ItemCatalogViewSchema";
import type { UpgradeView } from "~/v0/upgrade/view/UpgradeViewSchema";
import { cn } from "~/v0/ui/cn";

export namespace UpgradeCard {
	export interface Props {
		upgrade: UpgradeView;
		items?: ItemCatalogView;
		pending?: boolean;
		onBuy(upgradeId: UpgradeId): void;
	}
}

export const UpgradeCard: FC<UpgradeCard.Props> = ({ upgrade, items, pending, onBuy }) => {
	return (
		<div className="ak-ui-card p-3">
			<div className="flex min-w-0 items-start justify-between gap-3">
				<div className="min-w-0">
					<p className="truncate text-sm font-bold text-ak-text">{upgrade.name}</p>
					<p className="ak-ui-muted mt-1 break-words text-xs leading-5">
						{upgrade.description}
					</p>
				</div>
				<span className="shrink-0 rounded-sm bg-pink-50 px-2 py-1 text-xs font-black tabular-nums text-fuchsia-800">
					{upgrade.level}/{upgrade.maxLevel}
				</span>
			</div>

			{upgrade.currentEffects.length > 0 ? (
				<div className="mt-3 grid gap-1">
					<p className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-emerald-700/80">
						Active
					</p>
					{upgrade.currentEffects.map((effect) => (
						<p
							key={effect}
							className="rounded-sm bg-emerald-50 px-2 py-1 text-xs text-emerald-800"
						>
							{effect}
						</p>
					))}
				</div>
			) : null}

			{upgrade.nextEffects.length > 0 ? (
				<div className="mt-3 grid gap-1">
					<p className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-violet-700/80">
						Next
					</p>
					{upgrade.nextEffects.map((effect) => (
						<p
							key={effect}
							className="rounded-sm bg-pink-50/90 px-2 py-1 text-xs text-ak-text"
						>
							{effect}
						</p>
					))}
				</div>
			) : null}

			{upgrade.inProgress ? (
				<div className="mt-3 rounded-sm bg-violet-50/80 p-2">
					<div className="flex items-center justify-between text-xs font-bold text-violet-800">
						<span>Upgrade in progress</span>
						<span>{Math.round((upgrade.progress ?? 0) * 100)}%</span>
					</div>
					<div className="ak-ui-progress-track mt-2">
						<div
							className="ak-ui-progress-secondary"
							style={{
								width: `${Math.round((upgrade.progress ?? 0) * 100)}%`,
							}}
						/>
					</div>
				</div>
			) : null}

			<div className="mt-3 flex flex-wrap items-center gap-2">
				{upgrade.maxed ? (
					<span className="rounded-sm bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-800">
						Maxed
					</span>
				) : (
					upgrade.nextCost.map((cost) => {
						const enough = cost.available >= cost.quantity;
						return (
							<span
								key={cost.itemId}
								className={cn(
									"rounded-sm px-2 py-1 text-xs font-semibold",
									enough ? "bg-pink-50 text-ak-text" : "bg-rose-50 text-rose-800",
								)}
							>
								{items?.[cost.itemId]?.name ?? cost.itemId}: {cost.available}/
								{cost.quantity}
							</span>
						);
					})
				)}
			</div>

			<button
				className={cn(
					"ak-ui-button mt-3 w-full",
					upgrade.canBuy && !pending && !upgrade.inProgress
						? "ak-ui-button-primary"
						: "ak-ui-button-ghost",
				)}
				disabled={!upgrade.canBuy || upgrade.maxed || pending || upgrade.inProgress}
				type="button"
				onClick={() => onBuy(upgrade.id)}
			>
				{upgrade.maxed ? "Maxed" : upgrade.inProgress ? "In progress" : "Upgrade"}
			</button>
		</div>
	);
};
