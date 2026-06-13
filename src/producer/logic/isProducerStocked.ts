import type { ProducerView } from "~/play/logic/playTypes";

export function isProducerStocked(producer: ProducerView | undefined) {
	if (!producer) return false;

	return producer.inputs.every((input) => input.stored >= input.quantity);
}
