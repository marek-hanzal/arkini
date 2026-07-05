import type { LineRunState } from "~/producer/view/LineRunStateTypes";

const readLineRunActionVerb = ({ line }: LineRunState.Facts) =>
	line.kind === "effect" ? "activate" : "run";

export const readLineRunInputAvailabilityLabel = (facts: LineRunState.Facts) => {
	if (facts.line.visible === false) return "line hidden";
	if (facts.line.startRequirementsReady === false) return "requirements missing";
	if (facts.outputsDisabled) return "drops disabled";

	const actionLabel = readLineRunActionVerb(facts);
	if (facts.line.inputItemIds.length === 0) return `tap to ${actionLabel}`;
	if (facts.line.inputsReady) return "input ready";
	if (facts.line.inputsAvailable) return "auto-fill ready";
	if (facts.inputsPartiallyAvailable) return "partial fill ready";
	return "missing items";
};
