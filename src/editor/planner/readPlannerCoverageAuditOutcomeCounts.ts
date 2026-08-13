import type {
	PlannerCoverageAuditItem,
	PlannerCoverageAuditOutcomeCounts,
} from "~/editor/planner/PlannerCoverageAudit";

export const readPlannerCoverageAuditOutcomeCounts = (
	items: ReadonlyArray<PlannerCoverageAuditItem>,
): PlannerCoverageAuditOutcomeCounts => ({
	completed: items.filter(({ outcome }) => outcome === "completed").length,
	inconclusive: items.filter(({ outcome }) => outcome === "inconclusive").length,
	noFinitePath: items.filter(({ outcome }) => outcome === "no-finite-path").length,
});
