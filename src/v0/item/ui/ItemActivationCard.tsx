import type { FC } from "react";
import { activationStatusLabel } from "~/v0/item/logic/activationStatusLabel";
import type { ActivationView } from "~/v0/board/view/ActivationViewSchema";
import { readProducerCooldown } from "~/v0/producer/logic/readProducerCooldown";
import { UiSection } from "~/v0/ui/UiSection";

export namespace ItemActivationCard {
	export interface Props {
		activation: ActivationView;
		nowMs: number;
	}
}

export const ItemActivationCard: FC<ItemActivationCard.Props> = ({ activation, nowMs }) => {
	const cooldown = readProducerCooldown({
		activation,
		nowMs,
	});

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
		</UiSection>
	);
};
