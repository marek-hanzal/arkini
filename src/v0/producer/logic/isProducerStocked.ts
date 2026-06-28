import { readActivationInputViewFillableQuantity } from "~/v0/board/logic/readActivationInputViewFillableQuantity";
import { readActivationInputViewReady } from "~/v0/board/logic/readActivationInputViewReady";
import { readActivationRequirementViewReady } from "~/v0/board/logic/readActivationRequirementViewReady";
import type { ActivationView } from "~/v0/board/view/ActivationViewSchema";
import { readProducerProductLineRunState } from "~/v0/producer/logic/readProducerProductLineRunState";

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

	const inputsReady = activation.inputs.every(readActivationInputViewReady);
	const inputsFillable = activation.inputs.some(
		(input) => readActivationInputViewFillableQuantity(input) > 0,
	);

	return (
		(inputsReady || inputsFillable) &&
		activation.requirements.every(readActivationRequirementViewReady)
	);
}
