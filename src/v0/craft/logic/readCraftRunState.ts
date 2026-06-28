import type { ActivationRequirementView } from "~/v0/board/view/ActivationRequirementViewSchema";
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
		requirementsReady: boolean;
	}
}

const readRequirementReady = (requirement: ActivationRequirementView) =>
	requirement.type === "proximity"
		? requirement.satisfied
		: requirement.stored >= requirement.quantity;

const readCraftInputsPartiallyAvailable = (craft: CraftProgressView) =>
	craft.inputs.some((input) => {
		const delivered = craft.delivered[input.itemId] ?? 0;
		return delivered < input.quantity && (input.available ?? 0) > 0;
	});

export const readCraftRunState = ({ craft }: readCraftRunState.Props): readCraftRunState.Result => {
	const requirementsReady = (craft.requirements ?? []).every(readRequirementReady);
	const inputsReady = craft.inputProgress >= 1;
	const inputsPartiallyAvailable = readCraftInputsPartiallyAvailable(craft);
	const canClaim = craft.complete;
	const canRunAction =
		craft.phase === "collecting_inputs" &&
		!craft.complete &&
		requirementsReady &&
		(inputsReady || inputsPartiallyAvailable);

	if (craft.phase === "delivery_blocked") {
		return {
			canClaim,
			canRunAction,
			inputsPartiallyAvailable,
			inputsReady,
			label: "Delivery blocked",
			requirementsReady,
		};
	}

	if (craft.phase === "paused") {
		return {
			canClaim,
			canRunAction,
			inputsPartiallyAvailable,
			inputsReady,
			label: "Paused",
			requirementsReady,
		};
	}

	if (craft.phase === "ready") {
		return {
			canClaim,
			canRunAction,
			inputsPartiallyAvailable,
			inputsReady,
			label: "Claim",
			requirementsReady,
		};
	}

	if (craft.phase !== "collecting_inputs") {
		return {
			canClaim,
			canRunAction,
			inputsPartiallyAvailable,
			inputsReady,
			label: "Running",
			requirementsReady,
		};
	}

	if (!requirementsReady) {
		return {
			canClaim,
			canRunAction,
			inputsPartiallyAvailable,
			inputsReady,
			label: "Requirements missing",
			requirementsReady,
		};
	}

	if (inputsReady) {
		return {
			canClaim,
			canRunAction,
			inputsPartiallyAvailable,
			inputsReady,
			label: "Start craft",
			requirementsReady,
		};
	}

	if (inputsPartiallyAvailable) {
		return {
			canClaim,
			canRunAction,
			inputsPartiallyAvailable,
			inputsReady,
			label: "Auto-fill inputs",
			requirementsReady,
		};
	}

	return {
		canClaim,
		canRunAction,
		inputsPartiallyAvailable,
		inputsReady,
		label: "Auto-fill or drag inputs",
		requirementsReady,
	};
};
