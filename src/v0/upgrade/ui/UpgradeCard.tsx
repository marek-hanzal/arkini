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
		<div className="rounded-sm border border-ak-border bg-ak-surface-elevated p-3">
			<div className="flex min-w-0 items-start justify-between gap-3">
				<div className="min-w-0">
					<p className="truncate text-sm font-bold text-ak-text">{upgrade.name}</p>
					<p className="text-ak-text-muted mt-1 break-words text-xs leading-5">
						{upgrade.description}
					</p>
				</div>
				<span className="shrink-0 rounded-sm bg-ak-primary-soft px-2 py-1 text-xs font-black tabular-nums text-ak-primary">
					{upgrade.level}/{upgrade.maxLevel}
				</span>
			</div>

			{upgrade.currentEffects.length > 0 ? (
				<div className="mt-3 grid gap-1">
					<p className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-emerald-300">
						Active
					</p>
					{upgrade.currentEffects.map((effect) => (
						<p
							key={effect}
							className="rounded-sm bg-emerald-950/40 px-2 py-1 text-xs text-emerald-200"
						>
							{effect}
						</p>
					))}
				</div>
			) : null}

			{upgrade.nextEffects.length > 0 ? (
				<div className="mt-3 grid gap-1">
					<p className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-ak-primary">
						Next
					</p>
					{upgrade.nextEffects.map((effect) => (
						<p
							key={effect}
							className="rounded-sm bg-ak-surface-soft px-2 py-1 text-xs text-ak-text"
						>
							{effect}
						</p>
					))}
				</div>
			) : null}

			{upgrade.inProgress ? (
				<div className="mt-3 rounded-sm bg-ak-surface-soft p-2">
					<div className="flex items-center justify-between text-xs font-bold text-ak-primary">
						<span>Upgrade in progress</span>
						<span>{Math.round((upgrade.progress ?? 0) * 100)}%</span>
					</div>
					<div className="mt-2 h-2 overflow-hidden rounded-sm bg-ak-surface">
						<div
							className="h-full rounded-sm bg-ak-primary transition-[width] duration-200 ease-linear"
							style={{
								width: `${Math.round((upgrade.progress ?? 0) * 100)}%`,
							}}
						/>
					</div>
				</div>
			) : null}

			<div className="mt-3 flex flex-wrap items-center gap-2">
				{upgrade.maxed ? (
					<span className="rounded-sm bg-emerald-950/35 px-2 py-1 text-xs font-bold text-emerald-200">
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
									enough
										? "bg-ak-surface-soft text-ak-text"
										: "bg-rose-950/45 text-rose-200",
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
					"mt-3 min-h-10 w-full rounded-sm border px-3 py-2 text-xs font-extrabold leading-none transition-[transform,border-color,background,color,opacity] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45",
					upgrade.canBuy && !pending && !upgrade.inProgress
						? "border-ak-border-accent bg-ak-primary text-white hover:bg-pink-400"
						: "border-ak-border bg-ak-surface text-ak-text hover:border-ak-border-accent hover:bg-ak-surface-soft",
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
