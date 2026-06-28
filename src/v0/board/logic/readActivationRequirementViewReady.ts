import type { ActivationRequirementView } from "~/v0/board/view/ActivationRequirementViewSchema";

export const readActivationRequirementViewReady = (requirement: ActivationRequirementView) =>
	requirement.type === "proximity"
		? requirement.satisfied
		: requirement.stored >= requirement.quantity;
