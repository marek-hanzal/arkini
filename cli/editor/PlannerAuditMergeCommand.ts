import { Argument, Command } from "effect/unstable/cli";
import { Console, Effect } from "effect";

import { mergePlannerCoverageTierAuditReportsFx } from "~/editor/planner/mergePlannerCoverageTierAuditReportsFx";

import { readPlannerCoverageTierAuditReportFx } from "./readPlannerCoverageTierAuditReportFx";

const runPlannerAuditMergeFx = Effect.fn("runPlannerAuditMergeFx")(function* ({
	reports,
}: {
	readonly reports: ReadonlyArray<string>;
}) {
	const inputs = yield* Effect.forEach(reports, readPlannerCoverageTierAuditReportFx, {
		concurrency: 1,
	});
	const merged = yield* mergePlannerCoverageTierAuditReportsFx(inputs);
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
