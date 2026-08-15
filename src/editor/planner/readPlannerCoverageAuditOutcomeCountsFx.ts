import { Effect } from "effect";

import type {
	PlannerCoverageAuditItem,
	PlannerCoverageAuditOutcomeCounts,
} from "~/editor/planner/PlannerCoverageAudit";

export const readPlannerCoverageAuditOutcomeCountsFx = Effect.fn(
	"readPlannerCoverageAuditOutcomeCountsFx",
)((items: ReadonlyArray<PlannerCoverageAuditItem>) =>
	Effect.sync(
		(): PlannerCoverageAuditOutcomeCounts => ({
			completed: items.filter(({ outcome }) => outcome === "completed").length,
			inconclusive: items.filter(({ outcome }) => outcome === "inconclusive").length,
			noFinitePath: items.filter(({ outcome }) => outcome === "no-finite-path").length,
		}),
	),
);
