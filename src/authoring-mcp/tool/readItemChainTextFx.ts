import { Effect } from "effect";
import type { Project } from "~/project-authoring/type/Project";
import type { GraphDetailSchema } from "./GraphDetailSchema";
import { readItemChainsFn } from "~/item-chain/fn/readItemChainsFn";

const stopLabels = {
	final: "Final item",
	retained: "Remains",
	spent: "Spends one unit",
	cycle: "Clock loop",
	depth: "Depth limit",
	missing: "Missing item",
	ongoing: "No finite lifetime",
	"no-output": "No items emitted",
} as const;

const itemReferenceFn = (project: Project, itemId: string) => {
	const item = project.config.items[itemId];
	return item === undefined ? `${itemId} [missing]` : `${item.title} [${itemId}]`;
};
const quantityFn = ({ min, max }: { readonly min: number; readonly max: number }) =>
	min === max ? `×${min}` : `×${min}–${max}`;
const durationFn = (ms: number) => `${ms / 1000} s`;

const outputTextFn = (output: readItemChainsFn.OutputPath) =>
	[
		`${output.alternative ? "Alternative set" : "Outcome set"} ${output.set + 1} (weight ${output.setWeight})`,
		`Roll ${output.roll + 1}: ${output.type}`,
		...(output.chance === undefined
			? []
			: [
					`Chance ${output.chance * 100}%`,
				]),
		...(output.conditional
			? [
					"Depends on conditions",
				]
			: []),
	].join(" · ");

const operationLabelFn = (step: readItemChainsFn.Step) =>
	step.kind === "merge"
		? `Merge ${(step.mergeIndex ?? 0) + 1}`
		: step.kind === "expiry"
			? "Clock expiry"
			: `Clock line: ${step.lineTitle} [${step.lineId}]`;

/** Formats the complete bounded tree; no additional clipping or yield aggregation at the MCP boundary. */
const stepLinesFn = (project: Project, step: readItemChainsFn.Step, indent: string): string[] => {
	const lines = [
		`${indent}- ${itemReferenceFn(project, step.ownerId)} · ${operationLabelFn(step)}`,
		`${indent}  Path: ${step.path}`,
	];
	if (step.targetId !== undefined)
		lines.push(`${indent}  Drop onto: ${itemReferenceFn(project, step.targetId)}`);
	if (step.timeMs !== undefined)
		lines.push(
			`${indent}  ${step.kind === "pulse" ? "Clock interval" : "After"}: ${durationFn(step.timeMs)}`,
		);
	if (step.kind === "pulse") {
		lines.push(
			`${indent}  Clock weight: ${step.clockWeight}; line rules determine eligibility before weighted selection.`,
			`${indent}  Line duration: ${durationFn(step.runtimeMs ?? 0)}`,
			`${indent}  Lifetime: ${step.lifetimeMs === undefined ? "No finite lifetime" : durationFn(step.lifetimeMs)}`,
			`${indent}  Repeated output: shown once per admitted run; owner remains until expiry. Inputs, queueing and placement may delay or prevent production.`,
		);
	}
	if (step.sourceAction !== undefined) lines.push(`${indent}  Source: ${step.sourceAction}`);
	if (step.targetEffect !== undefined) lines.push(`${indent}  Target: ${step.targetEffect}`);
	lines.push(
		`${indent}  Disabled by default: ${step.disabled ? "yes" : "no"}`,
		`${indent}  Depends on conditions: ${step.conditional ? "yes" : "no"}`,
		`${indent}  Inputs: ${step.inputCount} (not expanded)`,
	);
	if (step.incomplete)
		lines.push(`${indent}  Incomplete: expansion safety limit; some branches omitted.`);
	if (step.branches.length === 0 && !step.incomplete) lines.push(`${indent}  No items emitted`);
	for (const node of step.branches) {
		lines.push(
			`${indent}  - ${itemReferenceFn(project, node.itemId)}${node.quantity === undefined ? "" : ` ${quantityFn(node.quantity)}`}${node.stop === undefined ? "" : ` · ${stopLabels[node.stop]}`}`,
			`${indent}    Path: ${node.path}`,
		);
		if (node.output !== undefined) lines.push(`${indent}    ${outputTextFn(node.output)}`);
		for (const child of node.steps) lines.push(...stepLinesFn(project, child, `${indent}    `));
	}
	return lines;
};

/** Preserve each initiating operation and immediate output branch without recursively repeating its descendants. */
const summaryStepLinesFn = (project: Project, step: readItemChainsFn.Step): string[] => [
	`- ${itemReferenceFn(project, step.ownerId)} · ${operationLabelFn(step)} (${step.path})${step.clockWeight === undefined ? "" : ` · Clock weight: ${step.clockWeight}`}${step.disabled ? " · Disabled by default" : ""}${step.conditional ? " · Depends on conditions" : ""}`,
	...step.branches.map(
		(node) =>
			`  - ${itemReferenceFn(project, node.itemId)}${node.quantity === undefined ? "" : ` ${quantityFn(node.quantity)}`}${node.stop === undefined ? "" : ` · ${stopLabels[node.stop]}`}${node.output === undefined ? "" : ` · ${outputTextFn(node.output)}`}`,
	),
	...(step.incomplete
		? [
				"  Incomplete: expansion safety limit; some branches omitted.",
			]
		: []),
	...(step.branches.length === 0 && !step.incomplete
		? [
				"  No items emitted",
			]
		: []),
];

/** Both detail levels use the same canonical bounded projection and outcome states. */
export const readItemChainTextFx = Effect.fn("readItemChainTextFx")(function* (
	project: Project,
	itemId: string,
	detail: GraphDetailSchema.Type = "full",
	maxDepth = 5,
) {
	if (project.config.items[itemId] === undefined)
		return yield* Effect.fail(new Error(`Item ${itemId} does not exist in the open project.`));
	const result = readItemChainsFn(project.config.items, itemId, maxDepth);
	const lines = [
		"Item Chain",
		`Item: ${itemReferenceFn(project, itemId)}`,
		`Project revision: ${project.revision}`,
		"Scope: the root item's own directional merges and Clock; after the first operation, only Clock expiry and Clock-selected line outcomes continue. Reverse merges, intermediate merges and production input acquisition are not traversed.",
		`Limits: maximum depth of ${maxDepth} operations, cycle detection and 400-expansion safety budget. Depth/loop/ongoing states are not final items.`,
		"Interpretation: authored possibilities, not runtime simulation. Times and quantities belong to individual operations. Periodic outputs are shown once per admitted run; quantities are not cumulative yields. Each Clock interval selects one eligible Clock line by clockWeight after evaluating line rules; the live pool and its probabilities are not evaluated here. One eligible output set is selected by weight. Guaranteed groups and chance groups run within that set; a chance group emits all its drops together when successful. Disabled defaults and runtime conditions can prevent outcomes.",
		`Truncated by safety limit: ${result.truncated ? "yes; some branches omitted" : "no"}`,
	];
	if (result.chains.length === 0)
		lines.push(
			"",
			"No chains: this item owns no merge or Clock. Incoming merges belong to their source item.",
		);
	for (const [index, chain] of result.chains.entries()) {
		lines.push(
			"",
			`Chain ${index + 1}: ${chain.kind} [${chain.id}]`,
			`Start: ${itemReferenceFn(project, chain.ownerId)}`,
			chain.targetId === undefined
				? "Trigger: Clock"
				: `Drop onto: ${itemReferenceFn(project, chain.targetId)}`,
			"Results:",
		);
		for (const outcome of chain.outcomes)
			lines.push(
				`- ${outcome.itemId === undefined ? "" : `${itemReferenceFn(project, outcome.itemId)} · `}${stopLabels[outcome.stop]}${outcome.periodic ? " · Repeated output" : ""}${outcome.conditional ? " · Conditional or alternative" : ""}`,
			);
		lines.push(detail === "full" ? "Details:" : "Starting operations:");
		for (const step of chain.steps)
			lines.push(
				...(detail === "full"
					? stepLinesFn(project, step, "")
					: summaryStepLinesFn(project, step)),
			);
	}
	return lines.join("\n");
});
