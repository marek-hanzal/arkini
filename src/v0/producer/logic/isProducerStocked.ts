import { readActivationInputViewFillableQuantity } from "~/v0/board/logic/readActivationInputViewFillableQuantity";
import { readActivationInputViewReady } from "~/v0/board/logic/readActivationInputViewReady";
import type { ActivationView } from "~/v0/board/view/ActivationViewSchema";
import { readProducerProductLineRunState } from "~/v0/producer/logic/readProducerProductLineRunState";

export function isProducerStocked(activation: ActivationView | undefined) {
	if (!activation) return false;

	if (activation.kind === "producer") {
		const readLineKind = (line: NonNullable<typeof activation.productLines>[number]) =>
			line.lineKind ?? "product";
		const defaultLines = [
			activation.productLines?.find(
				(line) => line.isDefault && readLineKind(line) === "effect",
			),
			activation.productLines?.find(
				(line) => line.isDefault && readLineKind(line) === "product",
			),
		].filter((line): line is NonNullable<typeof line> => Boolean(line));

		return defaultLines.some(
			(line) =>
				readProducerProductLineRunState({
					line,
				}).canRunAction,
		);
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

	return inputsReady || inputsFillable;
}
