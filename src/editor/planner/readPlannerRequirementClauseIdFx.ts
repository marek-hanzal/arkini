import { Effect } from "effect";

/** Stable identity for one authored planner route any-of requirement clause. */
export const readPlannerRequirementClauseIdFx = Effect.fn("readPlannerRequirementClauseIdFx")(
	(routeId: string, clauseIndex: number) =>
		Effect.succeed(
			JSON.stringify([
				"route-requirement-clause",
				routeId,
				clauseIndex,
			]),
		),
);
