import type { FC } from "react";
import { activationStatusLabel } from "~/item/logic/activationStatusLabel";
import type { ActivationView } from "~/play/logic/playTypes";
import { readProducerCooldown } from "~/producer/logic/readProducerCooldown";

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
		<div className="rounded-md border border-cyan-400/20 bg-cyan-950/18 p-3">
			<div className="flex items-center justify-between gap-3">
				<p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
					{title}
				</p>
				<p className="text-xs text-cyan-100">
					{activationStatusLabel({
						activation,
						nowMs,
					})}
				</p>
			</div>
			{cooldown ? (
				<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-950/80">
					<div
						className="h-full rounded-full bg-cyan-300/75 transition-[width] duration-200 ease-linear"
						style={{
							width: `${Math.round(cooldown.progress * 100)}%`,
						}}
					/>
				</div>
			) : null}
			{activation.remainingCharges !== undefined ? (
				<p className="mt-3 text-xs text-slate-300">
					Charges left: <strong>{activation.remainingCharges}</strong>
				</p>
			) : null}
		</div>
	);
};
