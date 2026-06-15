import type { ActivationView } from "~/board/view/ActivationViewSchema";
import { isProducerReady } from "~/producer/logic/isProducerReady";
import { isProducerStocked } from "~/producer/logic/isProducerStocked";
import { readProducerCooldown } from "~/producer/logic/readProducerCooldown";
import { formatMs } from "~/shared/util/formatMs";

export namespace activationStatusLabel {
	export interface Props {
		activation: ActivationView;
		nowMs: number;
	}
}

export const activationStatusLabel = ({ activation, nowMs }: activationStatusLabel.Props) => {
	const cooldown = readProducerCooldown({
		activation,
		nowMs,
	});
	const ready = isProducerReady(activation, nowMs);
	const hasCharges = activation.remainingCharges === undefined || activation.remainingCharges > 0;
	const hasInputs = isProducerStocked(activation);

	if (ready) return "Ready";
	if (!hasCharges) return "Empty";
	if (!cooldown) return hasInputs ? "Not ready" : "Needs inputs";
	return hasInputs
		? `Ready in ${formatMs(cooldown.remainingMs)}`
		: `Cooldown ${formatMs(cooldown.remainingMs)}`;
};
