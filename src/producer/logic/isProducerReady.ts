import type { ActivationView } from "~/play/logic/playTypes";
import { isProducerStocked } from "~/producer/logic/isProducerStocked";

export function isProducerReady(activation: ActivationView | undefined, nowMs: number) {
	if (!activation) return false;
	const cooldownUntil = activation.cooldownUntilMs ?? 0;
	const hasCharges = activation.remainingCharges === undefined || activation.remainingCharges > 0;
	return hasCharges && isProducerStocked(activation) && cooldownUntil <= nowMs;
}
