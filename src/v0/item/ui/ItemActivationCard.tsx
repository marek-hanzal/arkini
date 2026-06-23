import type { FC } from "react";
import type { ActivationView } from "~/v0/board/view/ActivationViewSchema";
import { activationStatusLabel } from "~/v0/item/logic/activationStatusLabel";
import { ItemInlineAsset } from "~/v0/item/ui/ItemInlineAsset";
import type { ItemCatalogView } from "~/v0/item/view/ItemCatalogViewSchema";
import { readProducerCooldown } from "~/v0/producer/logic/readProducerCooldown";
import { UiSection } from "~/v0/ui/UiSection";

export namespace ItemActivationCard {
	export interface Props {
		activation: ActivationView;
		items: ItemCatalogView;
		nowMs: number;
	}
}

export const ItemActivationCard: FC<ItemActivationCard.Props> = ({ activation, items, nowMs }) => {
	const cooldown = readProducerCooldown({
		activation,
		nowMs,
	});
	const drops = activation.kind === "stash" ? (activation.drops ?? []) : [];

	return (
		<UiSection
			eyebrow="Status"
			title={activation.kind === "stash" ? "Stash" : "Producer"}
			action={
				<span className="text-sm font-bold text-ak-primary">
					{activationStatusLabel({
						activation,
						nowMs,
					})}
				</span>
			}
		>
			{cooldown ? (
				<div className="h-1.5 overflow-hidden rounded-sm bg-ak-surface-soft">
					<div
						className="h-full rounded-sm bg-ak-primary transition-[width] duration-200 ease-linear"
						style={{
							width: `${Math.round(cooldown.progress * 100)}%`,
						}}
					/>
				</div>
			) : null}
			{activation.remainingCharges !== undefined ? (
				<p className="mt-3 text-sm text-ak-text-muted">
					Charges left:{" "}
					<strong className="text-ak-text">{activation.remainingCharges}</strong>
				</p>
			) : null}
			{drops.length ? (
				<div className="mt-3 grid gap-1.5">
					<p className="text-xs font-extrabold uppercase tracking-[0.18em] text-ak-primary">
						Drops
					</p>
					{drops.map((drop, index) => {
						const item = items[drop.itemId];
						return (
							<div
								key={`${index}:${drop.itemId}:${drop.chanceLabel}`}
								className="flex min-w-0 items-center gap-2 rounded-sm bg-ak-surface px-2.5 py-2 text-sm"
							>
								<ItemInlineAsset
									item={item}
									className="h-9 w-9"
								/>
								<div className="min-w-0 flex-1">
									<p className="break-words font-semibold text-ak-text">
										{item?.name ?? drop.itemId}
									</p>
									<p className="mt-0.5 break-words text-xs leading-5 text-ak-text-muted">
										{drop.rollLabel ? `${drop.rollLabel} · ` : ""}qty{" "}
										{drop.quantityLabel}
									</p>
								</div>
								<span className="shrink-0 rounded-sm bg-ak-primary/15 px-2 py-1 text-xs font-extrabold text-ak-primary">
									{drop.chanceLabel}
								</span>
							</div>
						);
					})}
				</div>
			) : null}
		</UiSection>
	);
};
