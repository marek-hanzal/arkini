import type { ActivationView } from "~/board/view/ActivationViewSchema";

export function isProducerStocked(activation: ActivationView | undefined) {
	if (!activation) return false;

	return (
		activation.inputs.every((input) => input.stored >= input.quantity) &&
		activation.requirements.every((requirement) => requirement.stored >= requirement.quantity)
	);
}
