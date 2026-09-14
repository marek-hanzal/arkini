/** One bounded wall-time window of Tick costs; diagnostic data, never gameplay state. */
export interface TickPerformance {
	readonly windowMs: number;
	readonly wakes: number;
	readonly advances: number;
	readonly failedAdvances: number;
	readonly simulationBudgetMs: number;
	readonly advanceMs: number;
	readonly maxAdvanceMs: number;
	readonly maxWakeGapMs: number;
	readonly droppedWallMs: number;
	readonly speedMultiplier: number;
	readonly items: number;
	readonly jobs: number;
	readonly queuedJobs: number;
}
