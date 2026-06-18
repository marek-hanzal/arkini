import type { FC } from "react";
import { activationStatusLabel } from "~/v0/item/logic/activationStatusLabel";
import type { ActivationView } from "~/v0/board/view/ActivationViewSchema";
import { readProducerCooldown } from "~/v0/producer/logic/readProducerCooldown";

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
	const title = activation.kind === "stash" ? "Stash status" : "Producer status";

	return (
		<div className="ak-ui-card-soft p-3">
			<div className="flex items-center justify-between gap-3">
				<p className="ak-ui-eyebrow">{title}</p>
				<p className="text-xs font-semibold text-violet-800">
					{activationStatusLabel({
						activation,
						nowMs,
					})}
				</p>
			</div>
			{cooldown ? (
				<div className="ak-ui-progress-track mt-2 h-1.5">
					<div
						className="ak-ui-progress-primary"
						style={{
							width: `${Math.round(cooldown.progress * 100)}%`,
						}}
					/>
				</div>
			) : null}
			{activation.remainingCharges !== undefined ? (
				<p className="ak-ui-muted mt-3 text-xs">
					Charges left:{" "}
					<strong className="text-ak-text">{activation.remainingCharges}</strong>
				</p>
			) : null}
		</div>
	);
};
