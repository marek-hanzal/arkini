import { readActivationInputViewFillableQuantity } from "~/v0/board/logic/readActivationInputViewFillableQuantity";
import { readActivationInputViewReady } from "~/v0/board/logic/readActivationInputViewReady";
import type { ActivationView } from "~/v0/board/view/ActivationViewSchema";
import { readLineRunState } from "~/v0/producer/logic/readLineRunState";

export function isProducerStocked(activation: ActivationView | undefined) {
	if (!activation) return false;

	if (activation.kind === "producer") {
		const defaultLines = [
			activation.lines?.find((line) => line.isDefault && line.kind === "effect"),
			activation.lines?.find((line) => line.isDefault && line.kind === "product"),
		].filter((line): line is NonNullable<typeof line> => Boolean(line));

		return defaultLines.some(
			(line) =>
				readLineRunState({
					line,
				}).canRunAction,
		);
	}

	const stashLine = activation.lines?.[0];
	if (stashLine) {
		return readLineRunState({
			line: stashLine,
		}).canRunAction;
	}

	const inputsReady = activation.inputs.every(readActivationInputViewReady);
	const inputsFillable = activation.inputs.some(
		(input) => readActivationInputViewFillableQuantity(input) > 0,
	);

	return inputsReady || inputsFillable;
}
