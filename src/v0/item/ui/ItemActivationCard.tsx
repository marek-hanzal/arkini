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
		<div className="rounded-sm border border-pink-200 bg-pink-50/40 p-3">
			<div className="flex items-center justify-between gap-3">
				<p className="text-[0.66rem] font-extrabold uppercase tracking-[0.16em] text-ak-primary">
					{title}
				</p>
				<p className="text-xs font-semibold text-violet-800">
					{activationStatusLabel({
						activation,
						nowMs,
					})}
				</p>
			</div>
			{cooldown ? (
				<div className="mt-2 h-1.5 overflow-hidden rounded-sm bg-pink-50">
					<div
						className="h-full rounded-sm bg-fuchsia-600 transition-[width] duration-200 ease-linear"
						style={{
							width: `${Math.round(cooldown.progress * 100)}%`,
						}}
					/>
				</div>
			) : null}
			{activation.remainingCharges !== undefined ? (
				<p className="text-ak-text-muted mt-3 text-xs">
					Charges left:{" "}
					<strong className="text-ak-text">{activation.remainingCharges}</strong>
				</p>
			) : null}
		</div>
	);
};
