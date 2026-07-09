export type GameDebugExplanationStatus = "accepted" | "blocked" | "info" | "warning";

export type GameDebugExplanationOutcome = "accepted" | "blocked" | "partial";

export type GameDebugExplanationDetailValue = boolean | number | string | undefined;

export type GameDebugExplanationStep = {
	code: string;
	details?: Record<string, GameDebugExplanationDetailValue>;
	message: string;
	status: GameDebugExplanationStatus;
};

export type GameDebugExplanation<TKind extends string = string> = {
	kind: TKind;
	outcome: GameDebugExplanationOutcome;
	steps: readonly GameDebugExplanationStep[];
};
