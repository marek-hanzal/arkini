import { readActivationInputViewFillableQuantity } from "~/board/view/readActivationInputViewFillableQuantity";
import type { LineView } from "~/board/view/LineViewSchema";
import type { LineRunState } from "~/producer/view/LineRunStateTypes";

const readInputsPartiallyAvailable = (line: LineView) =>
	!line.inputsReady &&
	line.inputs.some((input) => readActivationInputViewFillableQuantity(input) > 0);

export const readLineRunOutputsDisabled = (line: LineView) => {
	const outputs = line.outputs ?? [];
	return outputs.length > 0 && outputs.every((output) => output.enabled === false);
};

export const readLineRunFacts = ({ line }: { line: LineView }): LineRunState.Facts => {
	const inputsPartiallyAvailable = readInputsPartiallyAvailable(line);
	const outputsDisabled = readLineRunOutputsDisabled(line);
	const queueBlocked = line.queueBlockedReason !== undefined;
	return {
		canRunAction:
			(line.inputsReady || line.inputsAvailable || inputsPartiallyAvailable) &&
			line.pausedAtMs === undefined &&
			!line.deliveryBlocked &&
			!queueBlocked &&
			line.visible !== false &&
			line.startRequirementsReady !== false &&
			!line.effectLocked &&
			!line.outputLimitBlocked &&
			!outputsDisabled &&
			!line.blocked &&
			!line.queueFull,
		inputsPartiallyAvailable,
		line,
		outputsDisabled,
		queueBlocked,
	};
};
