import type {
	GameDebugExplanationOutcome,
	GameDebugExplanationStep,
} from "~/debug/explain/GameDebugExplanation";

export const readGameDebugExplanationOutcome = (
	steps: readonly GameDebugExplanationStep[],
): GameDebugExplanationOutcome => {
	if (steps.some((step) => step.status === "blocked")) return "blocked";
	if (steps.some((step) => step.status === "warning")) return "partial";
	return "accepted";
};
