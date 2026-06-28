import type { ProducerProductLineView } from "~/v0/board/view/ProducerProductLineViewSchema";

export namespace readProducerProductLineRunState {
	export interface Props {
		line: ProducerProductLineView;
	}

	export interface Result {
		canRunAction: boolean;
		inputsPartiallyAvailable: boolean;
		label: string;
	}
}

const readInputFillableQuantity = (input: ProducerProductLineView["inputs"][number]) =>
	Math.min(Math.max(0, input.quantity - input.stored), input.available ?? 0);

const readInputsPartiallyAvailable = (line: ProducerProductLineView) =>
	!line.inputsReady && line.inputs.some((input) => readInputFillableQuantity(input) > 0);

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
		!line.blocked &&
		!line.queueFull;

	if (line.pausedAtMs !== undefined) {
		return {
			canRunAction,
			inputsPartiallyAvailable,
			label: "Paused",
		};
	}

	if (line.deliveryBlocked || line.queueBlockedReason === "delivery_blocked") {
		return {
			canRunAction,
			inputsPartiallyAvailable,
			label: "Delivery blocked",
		};
	}

	if (line.queueBlockedReason === "paused") {
		return {
			canRunAction,
			inputsPartiallyAvailable,
			label: "Queue paused",
		};
	}

	if (line.queueFull) {
		return {
			canRunAction,
			inputsPartiallyAvailable,
			label: "Queue full",
		};
	}

	if (line.blocked) {
		return {
			canRunAction,
			inputsPartiallyAvailable,
			label: "Blocked by effect",
		};
	}

	if (!line.requirementsReady) {
		return {
			canRunAction,
			inputsPartiallyAvailable,
			label: "Requirements missing",
		};
	}

	if (!canRunAction) {
		return {
			canRunAction,
			inputsPartiallyAvailable,
			label: "Feed items by drag",
		};
	}

	if (line.inputsReady) {
		return {
			canRunAction,
			inputsPartiallyAvailable,
			label: "Start",
		};
	}

	if (line.inputsAvailable) {
		return {
			canRunAction,
			inputsPartiallyAvailable,
			label: "Auto-fill & start",
		};
	}

	if (inputsPartiallyAvailable) {
		return {
			canRunAction,
			inputsPartiallyAvailable,
			label: "Partial fill",
		};
	}

	return {
		canRunAction,
		inputsPartiallyAvailable,
		label: "Feed items by drag",
	};
};
