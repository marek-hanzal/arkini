import type { ProducerView } from "~/play/logic/playTypes";

export namespace readProducerCooldown {
	export interface Props {
		producer?: ProducerView;
		nowMs: number;
	}

	export interface Result {
		progress: number;
		remainingMs: number;
	}
}

export function readProducerCooldown({
	producer,
	nowMs,
}: readProducerCooldown.Props): readProducerCooldown.Result | undefined {
	if (!producer) return undefined;

	const hasCharges = producer.remainingCharges === undefined || producer.remainingCharges > 0;
	const cooldownUntilMs = producer.cooldownUntilMs ?? 0;
	const remainingMs = Math.max(0, cooldownUntilMs - nowMs);

	if (!hasCharges || remainingMs <= 0) return undefined;

	const cooldownMs = Math.max(1, producer.cooldownMs ?? remainingMs);
	const progress = Math.min(1, Math.max(0, 1 - remainingMs / cooldownMs));

	return {
		progress,
		remainingMs,
	};
}
