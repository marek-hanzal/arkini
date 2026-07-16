import type { ActivationView } from "~/board/view/ActivationViewSchema";

export namespace readProducerCooldown {
	export interface Props {
		activation?: ActivationView;
		nowMs: number;
	}
}

export function readProducerCooldown({ activation, nowMs }: readProducerCooldown.Props) {
	if (!activation) return undefined;

	const hasCharges = activation.remainingCharges === undefined || activation.remainingCharges > 0;
	const cooldownUntilMs = activation.cooldownUntilMs ?? 0;
	const remainingMs = Math.max(0, cooldownUntilMs - nowMs);
	if (!hasCharges || remainingMs <= 0) return undefined;

	const cooldownMs = Math.max(1, activation.cooldownMs ?? remainingMs);
	return {
		remainingMs,
		progress: Math.max(0, Math.min(1, 1 - remainingMs / cooldownMs)),
	};
}
