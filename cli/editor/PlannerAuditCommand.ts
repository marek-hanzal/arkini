import { Argument, Command, Flag } from "effect/unstable/cli";
import { Console, Effect } from "effect";

import { auditPlannerCoverageFx } from "~/editor/planner/auditPlannerCoverageFx";
import { auditPlannerCoverageTiersFx } from "~/editor/planner/auditPlannerCoverageTiersFx";
import { PlannerCoverageTierAuditInputError } from "~/editor/planner/PlannerCoverageTierAudit";
import { EditorItemPlannerSearchBudget } from "~/editor/simulator/createEngineBackedEditorItemSimulatorFx";
import { compileGameDirectoryFx } from "~/engine/compiler/fx/compileGameDirectoryFx";
import { assertGameConfigValidFx } from "~/engine/validation/fx/assertGameConfigValidFx";
import { printGameDiagnosticsForCliFx } from "~/engine/validation/printer/printGameDiagnosticsForCliFx";

import { parsePlannerCoverageTierSpec } from "./parsePlannerCoverageTierSpec";

const positiveIntegerFlag = ({
	defaultValue,
	description,
	name,
}: {
	readonly defaultValue: number;
	readonly description: string;
	readonly name: string;
}) => Flag.integer(name).pipe(Flag.withDefault(defaultValue), Flag.withDescription(description));

const runPlannerAuditFx = Effect.fn("runPlannerAuditFx")(function* ({
	input,
	limit,
	maximumExpandedStates,
	maximumQueuedStates,
	maximumRoutePlans,
	maximumTraceLength,
	offset,
	progress,
	quantity,
	tiers,
}: {
	readonly input: string;
	readonly limit: number;
	readonly maximumExpandedStates: number;
	readonly maximumQueuedStates: number;
	readonly maximumRoutePlans: number;
	readonly maximumTraceLength: number;
	readonly offset: number;
	readonly progress: boolean;
	readonly quantity: number;
	readonly tiers: string;
}) {
	const compilation = yield* compileGameDirectoryFx({
		input,
	});
	yield* printGameDiagnosticsForCliFx(compilation.diagnostics);
	const config = yield* assertGameConfigValidFx(compilation);
	const normalizedOffset = Math.max(0, Math.floor(offset));
	const normalizedLimit = Math.max(0, Math.floor(limit));
	const allItemIds = Object.keys(config.items).sort((left, right) => left.localeCompare(right));
	const itemIds = allItemIds.slice(
		normalizedOffset,
		normalizedLimit === 0 ? undefined : normalizedOffset + normalizedLimit,
	);
	const tierSpecification = tiers.trim();
	const report =
		tierSpecification.length === 0
			? yield* auditPlannerCoverageFx({
					budget: {
						maximumExpandedStates,
						maximumQueuedStates,
						maximumRoutePlans,
						maximumTraceLength,
					},
					config,
					itemIds,
					...(progress
						? {
								onProgress: ({ index, itemId, outcome, searchDurationMs, total }) =>
									Console.error(
										`[${index}/${total}] ${itemId}: ${outcome} (${searchDurationMs.toFixed(1)} ms)`,
									),
							}
						: {}),
					quantity,
				})
			: yield* auditPlannerCoverageTiersFx({
					config,
					itemIds,
					...(progress
						? {
								onProgress: ({
									index,
									itemId,
									outcome,
									searchDurationMs,
									tierCount,
									tierId,
									tierIndex,
									total,
								}) =>
									Console.error(
										`[tier ${tierIndex}/${tierCount} ${tierId}] [${index}/${total}] ${itemId}: ${outcome} (${searchDurationMs.toFixed(1)} ms)`,
									),
							}
						: {}),
					quantity,
					tiers: yield* Effect.try({
						catch: (cause) =>
							cause instanceof PlannerCoverageTierAuditInputError
								? cause
								: new PlannerCoverageTierAuditInputError({
										message: String(cause),
									}),
						try: () => parsePlannerCoverageTierSpec(tierSpecification),
					}),
				});
	yield* Console.log(JSON.stringify(report, undefined, 2));
});

export const PlannerAuditCommand = Command.make(
	"planner-audit",
	{
		input: Argument.directory("input").pipe(Argument.withDefault("game/arkini")),
		limit: Flag.integer("limit").pipe(
			Flag.withDefault(0),
			Flag.withDescription(
				"Audit at most this many sorted items; zero audits the remainder.",
			),
		),
		maximumExpandedStates: positiveIntegerFlag({
			defaultValue: EditorItemPlannerSearchBudget.maximumExpandedStates,
			description: "Maximum expanded runtime states across all route plans for one item.",
			name: "maximum-expanded-states",
		}),
		maximumQueuedStates: positiveIntegerFlag({
			defaultValue: EditorItemPlannerSearchBudget.maximumQueuedStates,
			description: "Maximum active frontier states retained for one item.",
			name: "maximum-queued-states",
		}),
		maximumRoutePlans: positiveIntegerFlag({
			defaultValue: EditorItemPlannerSearchBudget.maximumRoutePlans,
			description: "Maximum progressive route plans attempted for one item.",
			name: "maximum-route-plans",
		}),
		maximumTraceLength: positiveIntegerFlag({
			defaultValue: EditorItemPlannerSearchBudget.maximumTraceLength,
			description: "Maximum canonical engine actions in one candidate trace.",
			name: "maximum-trace-length",
		}),
		offset: Flag.integer("offset").pipe(
			Flag.withDefault(0),
			Flag.withDescription("Skip this many lexicographically sorted item IDs."),
		),
		progress: Flag.boolean("progress").pipe(
			Flag.withDescription("Print one compact progress line per audited item to stderr."),
		),
		quantity: positiveIntegerFlag({
			defaultValue: 1,
			description: "Target quantity requested from the planner for every item.",
			name: "quantity",
		}),
		tiers: Flag.string("tiers").pipe(
			Flag.withDefault(""),
			Flag.withDescription(
				"Run increasing saturation tiers using id=expanded:queued:routePlans:traceLength entries; single-budget flags are ignored.",
			),
		),
	},
	({
		input,
		limit,
		maximumExpandedStates,
		maximumQueuedStates,
		maximumRoutePlans,
		maximumTraceLength,
		offset,
		progress,
		quantity,
		tiers,
	}) =>
		runPlannerAuditFx({
			input,
			limit,
			maximumExpandedStates,
			maximumQueuedStates,
			maximumRoutePlans,
			maximumTraceLength,
			offset,
			progress,
			quantity,
			tiers,
		}),
).pipe(
	Command.withDescription(
		"Audit bounded engine-planner coverage over every item in one compiled game directory.",
	),
);
