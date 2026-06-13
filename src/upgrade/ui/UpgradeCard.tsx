import type { FC } from "react";
import type { ItemCatalogView, UpgradeView } from "~/play/logic/playTypes";
import { cn } from "~/shared/cn";

export namespace UpgradeCard {
	export interface Props {
		upgrade: UpgradeView;
		items?: ItemCatalogView;
		pending?: boolean;
		onBuy(upgradeId: string): void;
	}
}

export const UpgradeCard: FC<UpgradeCard.Props> = ({ upgrade, items, pending, onBuy }) => {
	return (
		<div className="rounded-md border border-slate-800 bg-slate-950/62 p-3">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<p className="text-sm font-bold text-slate-50">{upgrade.name}</p>
					<p className="mt-1 text-xs leading-5 text-slate-400">{upgrade.description}</p>
				</div>
				<span className="shrink-0 rounded-sm bg-slate-900 px-2 py-1 text-xs font-black tabular-nums text-emerald-200">
					{upgrade.level}/{upgrade.maxLevel}
				</span>
			</div>

			{upgrade.currentEffects.length > 0 ? (
				<div className="mt-3 space-y-1">
					<p className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
						Active
					</p>
					{upgrade.currentEffects.map((effect) => (
						<p
							key={effect}
							className="rounded-sm bg-emerald-950/22 px-2 py-1 text-xs text-emerald-100"
						>
							{effect}
						</p>
					))}
				</div>
			) : null}

			{upgrade.nextEffects.length > 0 ? (
				<div className="mt-3 space-y-1">
					<p className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
						Next
					</p>
					{upgrade.nextEffects.map((effect) => (
						<p
							key={effect}
							className="rounded-sm bg-slate-900/70 px-2 py-1 text-xs text-slate-300"
						>
							{effect}
						</p>
					))}
				</div>
			) : null}

			{upgrade.inProgress ? (
				<div className="mt-3 rounded-sm border border-amber-300/25 bg-amber-950/22 p-2">
					<div className="flex items-center justify-between text-xs font-bold text-amber-100">
						<span>Upgrade in progress</span>
						<span>{Math.round((upgrade.progress ?? 0) * 100)}%</span>
					</div>
					<div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-950/70">
						<div
							className="h-full rounded-full bg-amber-300/80"
							style={{
								width: `${Math.round((upgrade.progress ?? 0) * 100)}%`,
							}}
						/>
					</div>
				</div>
			) : null}

			<div className="mt-3 flex flex-wrap items-center gap-2">
				{upgrade.maxed ? (
					<span className="rounded-sm bg-emerald-400/15 px-2 py-1 text-xs font-bold text-emerald-200">
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
										? "bg-slate-900 text-slate-200"
										: "bg-red-950/40 text-red-200",
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
					"mt-3 w-full rounded-md px-3 py-2 text-sm font-black transition",
					upgrade.canBuy && !pending && !upgrade.inProgress
						? "bg-emerald-300 text-slate-950 active:scale-[0.99]"
						: "bg-slate-800 text-slate-500",
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
