import { readActivationInputViewFillableQuantity } from "~/v0/board/logic/readActivationInputViewFillableQuantity";
import type { ProducerProductLineView } from "~/v0/board/view/ProducerProductLineViewSchema";

export namespace readProducerProductLineRunState {
	export interface Props {
		line: ProducerProductLineView;
	}

	export interface Result {
		canRunAction: boolean;
		inputsPartiallyAvailable: boolean;
		inputAvailabilityLabel?: string;
		label: string;
		progressAutoCompleteMs?: number;
		progressLabel?: string;
		showProgress: boolean;
		statusMetaLabel?: string;
	}
}

const readLineKind = (line: ProducerProductLineView) => line.lineKind ?? "product";

const readInputsPartiallyAvailable = (line: ProducerProductLineView) =>
	!line.inputsReady &&
	line.inputs.some((input) => readActivationInputViewFillableQuantity(input) > 0);

const readInputAvailabilityLabel = ({
	inputsPartiallyAvailable,
	line,
}: {
	inputsPartiallyAvailable: boolean;
	line: ProducerProductLineView;
}) => {
	const actionLabel = readLineKind(line) === "effect" ? "activate" : "run";
	if (line.inputItemIds.length === 0) return `tap to ${actionLabel}`;
	if (line.inputsReady) return "input ready";
	if (line.inputsAvailable) return "auto-fill ready";
	if (inputsPartiallyAvailable) return "partial fill ready";
	return "needs input";
};

const readStatusMetaLabel = (line: ProducerProductLineView) => {
	if (line.deliveryBlocked || line.queueBlockedReason === "delivery_blocked") {
		return "delivery blocked";
	}
	if (line.queueBlockedReason === "paused") return "queue paused";
	if (line.pausedAtMs !== undefined) return "paused";
	if (line.queueFull) return "queue full";
	if (line.effectLocked) return readLineKind(line) === "effect" ? "effect active" : "locked";
	if (line.outputLimitBlocked) return "limit reached";
	if (line.blocked) return "blocked by effect";
	if (!line.requirementsReady) return "requirements missing";
	return undefined;
};

const withCommonState = ({
	canRunAction,
	inputsPartiallyAvailable,
	label,
	line,
}: {
	canRunAction: boolean;
	inputsPartiallyAvailable: boolean;
	label: string;
	line: ProducerProductLineView;
}): readProducerProductLineRunState.Result => ({
	canRunAction,
	inputsPartiallyAvailable,
	inputAvailabilityLabel: readInputAvailabilityLabel({
		inputsPartiallyAvailable,
		line,
	}),
	label,
	progressAutoCompleteMs:
		line.inProgress &&
		!line.deliveryBlocked &&
		line.pausedAtMs === undefined &&
		line.remainingMs !== undefined
			? line.remainingMs
			: undefined,
	progressLabel:
		line.pausedAtMs !== undefined
			? "Paused"
			: readLineKind(line) === "effect"
				? "Active"
				: "Running",
	showProgress: line.inProgress && !line.deliveryBlocked,
	statusMetaLabel: readStatusMetaLabel(line),
});

export const readProducerProductLineRunState = ({
	line,
}: readProducerProductLineRunState.Props): readProducerProductLineRunState.Result => {
	const inputsPartiallyAvailable = readInputsPartiallyAvailable(line);
	const queueBlocked = line.queueBlockedReason !== undefined;
	const canRunAction =
		(line.inputsReady || line.inputsAvailable || inputsPartiallyAvailable) &&
		line.requirementsReady &&
		line.pausedAtMs === undefined &&
		!line.deliveryBlocked &&
		!queueBlocked &&
		!line.effectLocked &&
		!line.outputLimitBlocked &&
		!line.blocked &&
		!line.queueFull;

	if (line.pausedAtMs !== undefined) {
		return withCommonState({
			canRunAction,
			inputsPartiallyAvailable,
			label: "Paused",
			line,
		});
	}

	if (line.deliveryBlocked || line.queueBlockedReason === "delivery_blocked") {
		return withCommonState({
			canRunAction,
			inputsPartiallyAvailable,
			label: "Delivery blocked",
			line,
		});
	}

	if (line.queueBlockedReason === "paused") {
		return withCommonState({
			canRunAction,
			inputsPartiallyAvailable,
			label: "Queue paused",
			line,
		});
	}

	if (line.queueFull) {
		return withCommonState({
			canRunAction,
			inputsPartiallyAvailable,
			label: "Queue full",
			line,
		});
	}

	if (line.effectLocked) {
		return withCommonState({
			canRunAction,
			inputsPartiallyAvailable,
			label: readLineKind(line) === "effect" ? "Active" : "Locked",
			line,
		});
	}

	if (line.outputLimitBlocked) {
		return withCommonState({
			canRunAction,
			inputsPartiallyAvailable,
			label: "Limit reached",
			line,
		});
	}

	if (line.blocked) {
		return withCommonState({
			canRunAction,
			inputsPartiallyAvailable,
			label: "Blocked by effect",
			line,
		});
	}

	if (!line.requirementsReady) {
		return withCommonState({
			canRunAction,
			inputsPartiallyAvailable,
			label: "Requirements missing",
			line,
		});
	}

	if (!canRunAction) {
		return withCommonState({
			canRunAction,
			inputsPartiallyAvailable,
			label: "Feed items by drag",
			line,
		});
	}

	if (line.inputsReady) {
		return withCommonState({
			canRunAction,
			inputsPartiallyAvailable,
			label: readLineKind(line) === "effect" ? "Activate" : "Start",
			line,
		});
	}

	if (line.inputsAvailable) {
		return withCommonState({
			canRunAction,
			inputsPartiallyAvailable,
			label: readLineKind(line) === "effect" ? "Auto-fill & activate" : "Auto-fill & start",
			line,
		});
	}

	if (inputsPartiallyAvailable) {
		return withCommonState({
			canRunAction,
			inputsPartiallyAvailable,
			label: "Partial fill",
			line,
		});
	}

	return withCommonState({
		canRunAction,
		inputsPartiallyAvailable,
		label: "Feed items by drag",
		line,
	});
};
