import type { ProducerView } from "~/play/logic/playTypes";
import { formatMs } from "~/shared/util/formatMs";
import type { ProducerUiState } from "~/item/logic/ProducerUiState";

export function getProducerUiState(producer: ProducerView, nowMs: number): ProducerUiState {
	const cooldownUntil = producer.cooldownUntilMs ?? 0;
	const cooldownLeft = Math.max(0, cooldownUntil - nowMs);
	const max = producer.cooldownMs ?? cooldownLeft;

	if (cooldownLeft > 0) {
		return {
			label: formatMs(cooldownLeft),
			title: `Cooling down: ${formatMs(cooldownLeft)}`,
			progress: max > 0 ? 1 - cooldownLeft / max : undefined,
			waiting: true,
		};
	}

	const charges = producer.remainingCharges;
	return {
		label: charges !== undefined ? String(charges) : "▶",
		title: charges !== undefined ? `${charges} charges left` : "Ready",
		waiting: false,
	};
}
