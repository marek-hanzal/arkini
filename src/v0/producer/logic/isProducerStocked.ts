import type { ActivationRequirementView } from "~/v0/board/view/ActivationRequirementViewSchema";
import type { ActivationView } from "~/v0/board/view/ActivationViewSchema";

const isRequirementReady = (requirement: ActivationRequirementView) =>
	requirement.type === "proximity"
		? requirement.satisfied
		: requirement.stored >= requirement.quantity;

export function isProducerStocked(activation: ActivationView | undefined) {
	if (!activation) return false;

	return (
		activation.inputs.every((input) => input.stored >= input.quantity) &&
		activation.requirements.every(isRequirementReady)
	);
}
