import type { ActivationView } from "~/play/logic/playTypes";

export function isProducerStocked(activation: ActivationView | undefined) {
	if (!activation) return false;

	return activation.inputs.every((input) => input.stored >= input.quantity);
}
