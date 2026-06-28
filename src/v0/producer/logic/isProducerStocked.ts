import type { ActivationRequirementView } from "~/v0/board/view/ActivationRequirementViewSchema";
import type { ActivationView } from "~/v0/board/view/ActivationViewSchema";
import { readProducerProductLineRunState } from "~/v0/producer/logic/readProducerProductLineRunState";

const isRequirementReady = (requirement: ActivationRequirementView) =>
	requirement.type === "proximity"
		? requirement.satisfied
		: requirement.stored >= requirement.quantity;

export function isProducerStocked(activation: ActivationView | undefined) {
	if (!activation) return false;

	if (activation.kind === "producer") {
		const defaultLine = activation.productLines?.find((line) => line.isDefault);
		return defaultLine
			? readProducerProductLineRunState({
					line: defaultLine,
				}).canRunAction
			: false;
	}

	return (
		activation.inputs.every(
			(input) =>
				input.stored >= input.quantity ||
				input.stored + (input.available ?? 0) >= input.quantity,
		) && activation.requirements.every(isRequirementReady)
	);
}
