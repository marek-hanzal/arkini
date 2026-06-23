import type { ActivationRequirementView } from "~/v0/board/view/ActivationRequirementViewSchema";
import type { ActivationView } from "~/v0/board/view/ActivationViewSchema";

const isRequirementReady = (requirement: ActivationRequirementView) =>
	requirement.type === "proximity"
		? requirement.satisfied
		: requirement.stored >= requirement.quantity;

export function isProducerStocked(activation: ActivationView | undefined) {
	if (!activation) return false;

	if (activation.kind === "producer") {
		const defaultLine = activation.productLines?.find((line) => line.isDefault);
		return Boolean(
			defaultLine &&
				(defaultLine.inputsReady || defaultLine.inputsAvailable) &&
				defaultLine.requirementsReady &&
				!defaultLine.queueFull,
		);
	}

	return (
		activation.inputs.every(
			(input) =>
				input.stored >= input.quantity ||
				input.stored + (input.available ?? 0) >= input.quantity,
		) && activation.requirements.every(isRequirementReady)
	);
}
