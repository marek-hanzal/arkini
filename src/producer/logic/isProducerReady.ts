import type { ProducerView } from "~/play/logic/playTypes";

export function isProducerReady(producer: ProducerView | null | undefined, nowMs: number) {
	if (!producer) return false;

	const cooldownUntil = producer.cooldownUntil ? Date.parse(producer.cooldownUntil) : 0;
	const hasCharges =
		producer.remainingCharges === null ||
		producer.remainingCharges === undefined ||
		producer.remainingCharges > 0;

	return hasCharges && cooldownUntil <= nowMs;
}
