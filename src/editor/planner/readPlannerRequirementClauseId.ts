/** Stable identity for one authored planner route any-of requirement clause. */
export const readPlannerRequirementClauseId = (routeId: string, clauseIndex: number) =>
	JSON.stringify([
		"route-requirement-clause",
		routeId,
		clauseIndex,
	]);
