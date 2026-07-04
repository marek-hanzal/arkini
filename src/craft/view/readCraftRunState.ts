import type { CraftProgressView } from "~/board/view/CraftProgressViewSchema";

export namespace readCraftRunState {
	export interface Props {
		craft: CraftProgressView;
	}

	export interface Result {
		canClaim: boolean;
		canRunAction: boolean;
		inputsPartiallyAvailable: boolean;
		inputsReady: boolean;
		label: string;
	}
}

const readCraftInputsPartiallyAvailable = (craft: CraftProgressView) =>
	craft.inputs.some((input) => {
		const delivered = craft.delivered[input.itemId] ?? 0;
		return delivered < input.quantity && (input.available ?? 0) > 0;
	});

export const readCraftRunState = ({ craft }: readCraftRunState.Props): readCraftRunState.Result => {
	const inputsReady = craft.inputProgress >= 1;
	const inputsPartiallyAvailable = readCraftInputsPartiallyAvailable(craft);
	const startRequirementsReady = craft.startRequirementsReady !== false;
	const effectBlocked = craft.effectBlocked === true;
	const canClaim = craft.complete;
	const canRunAction =
		craft.phase === "collecting_inputs" &&
		!craft.complete &&
		!craft.targetLimitBlocked &&
		!effectBlocked &&
		startRequirementsReady &&
		(inputsReady || inputsPartiallyAvailable);

	if (craft.phase === "delivery_blocked") {
		return {
			canClaim,
			canRunAction,
			inputsPartiallyAvailable,
			inputsReady,
			label: "Delivery blocked",
		};
	}

	if (craft.phase === "paused") {
		return {
			canClaim,
			canRunAction,
			inputsPartiallyAvailable,
			inputsReady,
			label: "Paused",
		};
	}

	if (craft.phase === "ready") {
		return {
			canClaim,
			canRunAction,
			inputsPartiallyAvailable,
			inputsReady,
			label: "Claim",
		};
	}

	if (craft.phase !== "collecting_inputs") {
		return {
			canClaim,
			canRunAction,
			inputsPartiallyAvailable,
			inputsReady,
			label: "Running",
		};
	}

	if (craft.targetLimitBlocked) {
		return {
			canClaim,
			canRunAction,
			inputsPartiallyAvailable,
			inputsReady,
			label: "Limit reached",
		};
	}

	if (effectBlocked) {
		return {
			canClaim,
			canRunAction,
			inputsPartiallyAvailable,
			inputsReady,
			label: "Blocked",
		};
	}

	if (!startRequirementsReady) {
		return {
			canClaim,
			canRunAction,
			inputsPartiallyAvailable,
			inputsReady,
			label: "Requirements missing",
		};
	}

	if (inputsReady) {
		return {
			canClaim,
			canRunAction,
			inputsPartiallyAvailable,
			inputsReady,
			label: "Start craft",
		};
	}

	if (inputsPartiallyAvailable) {
		return {
			canClaim,
			canRunAction,
			inputsPartiallyAvailable,
			inputsReady,
			label: "Auto-fill inputs",
		};
	}

	return {
		canClaim,
		canRunAction,
		inputsPartiallyAvailable,
		inputsReady,
		label: "Auto-fill or drag inputs",
	};
};
