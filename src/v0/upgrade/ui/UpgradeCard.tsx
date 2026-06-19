import type { FC } from "react";
import type { UpgradeId } from "~/v0/manifest/manifestId";
import type { ItemCatalogView } from "~/v0/item/view/ItemCatalogViewSchema";
import type { UpgradeView } from "~/v0/upgrade/view/UpgradeViewSchema";
import { cn } from "~/v0/ui/cn";
import { UiButton } from "~/v0/ui/UiButton";
import { UiSection } from "~/v0/ui/UiSection";

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
		<UiSection
			title={upgrade.name}
			action={
				<span className="rounded-sm bg-ak-primary-soft px-2 py-1 text-xs font-black tabular-nums text-ak-primary">
					{upgrade.level}/{upgrade.maxLevel}
				</span>
			}
		>
			<p className="break-words text-sm leading-6 text-ak-text-muted">
				{upgrade.description}
			</p>

			{upgrade.currentEffects.length > 0 ? (
				<div className="mt-3 grid gap-1">
					<p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-emerald-300">
						Active
					</p>
					{upgrade.currentEffects.map((effect) => (
						<p
							key={effect}
							className="rounded-sm bg-emerald-500/10 px-2.5 py-2 text-sm text-emerald-200"
						>
							{effect}
						</p>
					))}
				</div>
			) : null}

			{upgrade.nextEffects.length > 0 ? (
				<div className="mt-3 grid gap-1">
					<p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-ak-primary">
						Next
					</p>
					{upgrade.nextEffects.map((effect) => (
						<p
							key={effect}
							className="rounded-sm bg-ak-surface px-2.5 py-2 text-sm text-ak-text-muted"
						>
							{effect}
						</p>
					))}
				</div>
			) : null}

			{upgrade.inProgress ? (
				<div className="mt-3 rounded-sm bg-ak-surface p-2.5">
					<div className="flex items-center justify-between text-sm font-bold text-ak-primary">
						<span>Upgrade in progress</span>
						<span>{Math.round((upgrade.progress ?? 0) * 100)}%</span>
					</div>
					<div className="mt-2 h-2 overflow-hidden rounded-sm bg-ak-surface-soft">
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
					<span className="rounded-sm bg-emerald-500/10 px-2 py-1 text-xs font-bold text-emerald-200">
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
										? "bg-ak-surface text-ak-text-muted"
										: "bg-rose-500/10 text-rose-200",
								)}
							>
								{items?.[cost.itemId]?.name ?? cost.itemId}: {cost.available}/
								{cost.quantity}
							</span>
						);
					})
				)}
			</div>

			<UiButton
				className="mt-3"
				tone={upgrade.canBuy && !pending && !upgrade.inProgress ? "primary" : "secondary"}
				disabled={!upgrade.canBuy || upgrade.maxed || pending || upgrade.inProgress}
				onClick={() => onBuy(upgrade.id)}
			>
				{upgrade.maxed ? "Maxed" : upgrade.inProgress ? "In progress" : "Upgrade"}
			</UiButton>
		</UiSection>
	);
};
