import type { ProducerView } from "~/play/logic/playTypes";
import { isProducerStocked } from "~/producer/logic/isProducerStocked";

export function isProducerReady(producer: ProducerView | undefined, nowMs: number) {
	if (!producer) return false;

	const cooldownUntil = producer.cooldownUntilMs ?? 0;
	const hasCharges = producer.remainingCharges === undefined || producer.remainingCharges > 0;
	return hasCharges && isProducerStocked(producer) && cooldownUntil <= nowMs;
}
