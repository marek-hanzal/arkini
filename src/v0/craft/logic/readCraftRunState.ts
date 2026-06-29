import type { CraftProgressView } from "~/v0/board/view/CraftProgressViewSchema";

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
	const grantsReady = craft.grantsReady !== false;
	const canClaim = craft.complete;
	const canRunAction =
		craft.phase === "collecting_inputs" &&
		!craft.complete &&
		!craft.targetLimitBlocked &&
		grantsReady &&
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

	if (!grantsReady) {
		return {
			canClaim,
			canRunAction,
			inputsPartiallyAvailable,
			inputsReady,
			label: "Grants missing",
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
