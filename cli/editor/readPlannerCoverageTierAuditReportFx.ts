import { Effect, FileSystem } from "effect";

import {
	PlannerCoverageTierAuditInputError,
	type PlannerCoverageTierAuditReport,
} from "~/editor/planner/PlannerCoverageTierAudit";

export const readPlannerCoverageTierAuditReportFx = Effect.fn(
	"readPlannerCoverageTierAuditReportFx",
)(function* (path: string) {
	const fileSystem = yield* FileSystem.FileSystem;
	const source = yield* fileSystem.readFileString(path);
	const value = yield* Effect.try({
		catch: (cause) =>
			new PlannerCoverageTierAuditInputError({
				message: `Cannot parse planner coverage tier report ${path}: ${String(cause)}`,
			}),
		try: () => JSON.parse(source) as unknown,
	});
	if (
		typeof value !== "object" ||
		value === null ||
		!("version" in value) ||
		value.version !== 1 ||
		!("items" in value) ||
		!Array.isArray(value.items) ||
		!("tiers" in value) ||
		!Array.isArray(value.tiers)
	)
		return yield* new PlannerCoverageTierAuditInputError({
			message: `File is not a planner coverage tier report: ${path}.`,
		});
	return value as unknown as PlannerCoverageTierAuditReport;
});
