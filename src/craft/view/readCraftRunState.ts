import { match } from "ts-pattern";
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

type CraftRunFacts = {
	canClaim: boolean;
	canRunAction: boolean;
	effectBlocked: boolean;
	inputsPartiallyAvailable: boolean;
	inputsReady: boolean;
	startRequirementsReady: boolean;
};

const readCraftInputsPartiallyAvailable = (craft: CraftProgressView) =>
	craft.inputs.some((input) => {
		const delivered = craft.delivered[input.itemId] ?? 0;
		return delivered < input.quantity && (input.available ?? 0) > 0;
	});

const readCraftRunFacts = (craft: CraftProgressView): CraftRunFacts => {
	const inputsReady = craft.inputProgress >= 1;
	const inputsPartiallyAvailable = readCraftInputsPartiallyAvailable(craft);
	const startRequirementsReady = craft.startRequirementsReady !== false;
	const effectBlocked = craft.effectBlocked === true;
	const canClaim = craft.complete;
	return {
		canClaim,
		canRunAction:
			craft.phase === "collecting_inputs" &&
			!craft.complete &&
			!craft.targetLimitBlocked &&
			!effectBlocked &&
			startRequirementsReady &&
			(inputsReady || inputsPartiallyAvailable),
		effectBlocked,
		inputsPartiallyAvailable,
		inputsReady,
		startRequirementsReady,
	};
};

const readCollectingInputsLabel = ({
	craft,
	facts,
}: {
	craft: CraftProgressView;
	facts: CraftRunFacts;
}) => {
	if (craft.targetLimitBlocked) return "Limit reached";
	if (facts.effectBlocked) return "Blocked";
	if (!facts.startRequirementsReady) return "Requirements missing";
	if (facts.inputsReady) return "Start craft";
	if (facts.inputsPartiallyAvailable) return "Auto-fill inputs";
	return "Auto-fill or drag inputs";
};

const readCraftRunLabel = ({ craft, facts }: { craft: CraftProgressView; facts: CraftRunFacts }) =>
	match(craft.phase)
		.with("delivery_blocked", () => "Delivery blocked")
		.with("paused", () => "Paused")
		.with("ready", () => "Claim")
		.with("waiting", () => "Running")
		.with("collecting_inputs", () =>
			readCollectingInputsLabel({
				craft,
				facts,
			}),
		)
		.exhaustive();

export const readCraftRunState = ({ craft }: readCraftRunState.Props): readCraftRunState.Result => {
	const facts = readCraftRunFacts(craft);
	return {
		canClaim: facts.canClaim,
		canRunAction: facts.canRunAction,
		inputsPartiallyAvailable: facts.inputsPartiallyAvailable,
		inputsReady: facts.inputsReady,
		label: readCraftRunLabel({
			craft,
			facts,
		}),
	};
};
