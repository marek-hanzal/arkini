import { readActivationInputViewFillableQuantity } from "~/board/view/readActivationInputViewFillableQuantity";
import type { LineView } from "~/board/view/LineViewSchema";
import type { LineRunState } from "~/producer/view/LineRunStateTypes";
import { readLineRunInputAvailabilityLabel } from "~/producer/view/readLineRunInputAvailabilityLabel";
import { readLineRunLabel } from "~/producer/view/readLineRunLabel";
import { readLineRunProgressLabel } from "~/producer/view/readLineRunProgressLabel";
import { readLineRunStatusMetaLabel } from "~/producer/view/readLineRunStatusMetaLabel";

export namespace readLineRunState {
	export type Props = LineRunState.Props;
	export type Result = LineRunState.Result;
}

const readInputsPartiallyAvailable = (line: LineView) =>
	!line.inputsReady &&
	line.inputs.some((input) => readActivationInputViewFillableQuantity(input) > 0);

const readOutputsDisabled = (line: LineView) => {
	const outputs = line.outputs ?? [];
	return outputs.length > 0 && outputs.every((output) => output.enabled === false);
};

export const readLineRunState = ({ line }: readLineRunState.Props): readLineRunState.Result => {
	const inputsPartiallyAvailable = readInputsPartiallyAvailable(line);
	const outputsDisabled = readOutputsDisabled(line);
	const queueBlocked = line.queueBlockedReason !== undefined;
	const canRunAction =
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
		!line.queueFull;

	return {
		canRunAction,
		inputsPartiallyAvailable,
		inputAvailabilityLabel: readLineRunInputAvailabilityLabel({
			canRunAction,
			inputsPartiallyAvailable,
			line,
			outputsDisabled,
			queueBlocked,
		}),
		label: readLineRunLabel({
			canRunAction,
			inputsPartiallyAvailable,
			line,
			outputsDisabled,
			queueBlocked,
		}),
		progressLabel: readLineRunProgressLabel({
			line,
		}),
		showProgress: line.inProgress && !line.deliveryBlocked,
		statusMetaLabel: readLineRunStatusMetaLabel({
			canRunAction,
			inputsPartiallyAvailable,
			line,
			outputsDisabled,
			queueBlocked,
		}),
	};
};
