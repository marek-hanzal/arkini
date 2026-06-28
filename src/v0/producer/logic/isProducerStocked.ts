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

	const stashLine = activation.productLines?.[0];
	if (stashLine) {
		return readProducerProductLineRunState({
			line: stashLine,
		}).canRunAction;
	}

	const inputsReady = activation.inputs.every((input) => input.stored >= input.quantity);
	const inputsFillable = activation.inputs.some((input) => {
		const missingQuantity = input.quantity - input.stored;
		return missingQuantity > 0 && Math.min(missingQuantity, input.available ?? 0) > 0;
	});

	return (inputsReady || inputsFillable) && activation.requirements.every(isRequirementReady);
}
