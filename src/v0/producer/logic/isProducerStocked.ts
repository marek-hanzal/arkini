import { readActivationInputViewFillableQuantity } from "~/v0/board/logic/readActivationInputViewFillableQuantity";
import { readActivationInputViewReady } from "~/v0/board/logic/readActivationInputViewReady";
import type { ActivationView } from "~/v0/board/view/ActivationViewSchema";
import { readProducerLineRunState } from "~/v0/producer/logic/readProducerLineRunState";

export function isProducerStocked(activation: ActivationView | undefined) {
	if (!activation) return false;

	if (activation.kind === "producer") {
		const defaultLines = [
			activation.producerLines?.find((line) => line.isDefault && line.lineKind === "effect"),
			activation.producerLines?.find((line) => line.isDefault && line.lineKind === "product"),
		].filter((line): line is NonNullable<typeof line> => Boolean(line));

		return defaultLines.some(
			(line) =>
				readProducerLineRunState({
					line,
				}).canRunAction,
		);
	}

	const stashLine = activation.producerLines?.[0];
	if (stashLine) {
		return readProducerLineRunState({
			line: stashLine,
		}).canRunAction;
	}

	const inputsReady = activation.inputs.every(readActivationInputViewReady);
	const inputsFillable = activation.inputs.some(
		(input) => readActivationInputViewFillableQuantity(input) > 0,
	);

	return inputsReady || inputsFillable;
}
