export interface PlannerSearchPriority {
	readonly preferredHeadroomByDepth: ReadonlyArray<number>;
	readonly preferredProgressByDepth: ReadonlyArray<number>;
	readonly scopeProgress: number;
}
