import { Argument, Command } from "effect/unstable/cli";
import { Console, Effect, FileSystem } from "effect";

import {
	PlannerCoverageTierAuditInputError,
	type PlannerCoverageTierAuditReport,
} from "~/editor/planner/PlannerCoverageTierAudit";
import { mergePlannerCoverageTierAuditReports } from "~/editor/planner/mergePlannerCoverageTierAuditReports";

const readReportFx = Effect.fn("readPlannerCoverageTierAuditReportFx")(function* (path: string) {
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

const runPlannerAuditMergeFx = Effect.fn("runPlannerAuditMergeFx")(function* ({
	reports,
}: {
	readonly reports: ReadonlyArray<string>;
}) {
	const inputs = yield* Effect.forEach(reports, readReportFx, {
		concurrency: 1,
	});
	const merged = yield* Effect.try({
		catch: (cause) =>
			cause instanceof PlannerCoverageTierAuditInputError
				? cause
				: new PlannerCoverageTierAuditInputError({
						message: String(cause),
					}),
		try: () => mergePlannerCoverageTierAuditReports(inputs),
	});
	yield* Console.log(JSON.stringify(merged, undefined, 2));
});

export const PlannerAuditMergeCommand = Command.make(
	"planner-audit-merge",
	{
		reports: Argument.file("reports").pipe(
			Argument.variadic({
				min: 1,
			}),
		),
	},
	runPlannerAuditMergeFx,
).pipe(
	Command.withDescription(
		"Merge disjoint planner coverage tier audit shards and recompute all aggregate statistics.",
	),
);
