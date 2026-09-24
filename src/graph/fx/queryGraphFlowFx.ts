import { Clock, Effect } from "effect";
import { match } from "ts-pattern";
import type {
	GraphOperationIndex,
	GraphIndexedOperation,
	GraphOperationOutput,
} from "~/graph/type/GraphOperationIndex";
import { GraphQueryError } from "~/graph/error/GraphQueryError";
import type { GraphFlowQuerySchema } from "~/graph/schema/GraphFlowQuerySchema";
import type { GraphFlow, GraphFlowResult, GraphFlowStep } from "~/graph/type/GraphFlow";

interface CausalPath {
	readonly flow: GraphFlow;
	readonly available: ReadonlySet<string>;
	readonly unavailable: ReadonlySet<string>;
	readonly visited: ReadonlySet<string>;
}

const stateKeyFn = (
	current: string,
	available: ReadonlySet<string>,
	unavailable: ReadonlySet<string>,
): string =>
	JSON.stringify([
		current,
		[
			...available,
		].sort(),
		[
			...unavailable,
		].sort(),
	]);

const advanceFn = (path: CausalPath, step: GraphFlowStep): CausalPath | undefined => {
	const required = [
		step.from,
		...step.evidence.prerequisiteNodes,
	];
	if (required.some((node) => path.unavailable.has(node))) return undefined;
	const available = new Set([
		...path.available,
		...required,
	]);
	const unavailable = new Set(path.unavailable);
	const external = new Set(path.flow.externalPrerequisiteNodes);
	for (const node of required) if (!path.available.has(node)) external.add(node);
	// Apply the entire operation before selecting a product branch. A consumed counterpart
	// cannot silently become a new external prerequisite later in the same lineage.
	for (const { node, effect } of step.evidence.participantEffects) {
		if (effect === "preserved") continue;
		available.delete(node);
		unavailable.add(node);
	}
	for (const node of step.evidence.createdNodes) {
		available.add(node);
		unavailable.delete(node);
	}
	const key = stateKeyFn(step.to, available, unavailable);
	if (path.visited.has(key)) return undefined;
	return {
		flow: {
			nodes: [
				...path.flow.nodes,
				step.to,
			],
			steps: [
				...path.flow.steps,
				step,
			],
			externalPrerequisiteNodes: [
				...external,
			].sort(),
		},
		available,
		unavailable,
		visited: new Set([
			...path.visited,
			key,
		]),
	};
};

const stepFn = (
	entry: GraphIndexedOperation,
	output: GraphOperationOutput,
	from: string,
): GraphFlowStep => ({
	from,
	to: output.to,
	operationId: entry.operation.id,
	kind: entry.operation.kind,
	owner: entry.operation.owner,
	evidence: {
		fromRole: entry.required.find((participant) => participant.node === from)!.role,
		participantEffects: entry.required.map(({ node, effect }) => ({
			node,
			effect,
		})),
		createdNodes: output.createdNodes,
		output: output.output,
		prerequisiteNodes: entry.required
			.filter((participant) => participant.node !== from)
			.map((participant) => participant.node),
		prerequisites: [
			...entry.prerequisites,
			...output.prerequisites,
		],
		...(output.chance === undefined
			? {}
			: {
					chance: output.chance,
				}),
		...(output.alternative === undefined
			? {}
			: {
					alternative: output.alternative,
				}),
		...(output.quantityMin === undefined
			? {}
			: {
					quantityMin: output.quantityMin,
				}),
		...(output.quantityMax === undefined
			? {}
			: {
					quantityMax: output.quantityMax,
				}),
	},
});

const compareFlowsFn = (left: GraphFlow, right: GraphFlow): number => {
	const branchesFn = (flow: GraphFlow): number =>
		flow.steps.filter((step) => step.evidence.output === "outcome" && step.kind === "merge")
			.length +
		flow.nodes.length -
		new Set(flow.nodes).size;
	const replacementsFn = (flow: GraphFlow): number =>
		flow.steps.filter((step) => step.evidence.output === "replacement").length;
	return (
		left.steps.length - right.steps.length ||
		left.externalPrerequisiteNodes.length - right.externalPrerequisiteNodes.length ||
		branchesFn(left) - branchesFn(right) ||
		replacementsFn(right) - replacementsFn(left)
	);
};

/** Complete a breadth layer before ranking; never reuse a retired participant without recreation. */
export const queryGraphFlowFx = Effect.fn("queryGraphFlowFx")(function* (
	index: GraphOperationIndex,
	query: GraphFlowQuerySchema.Type,
): Effect.fn.Return<GraphFlowResult, GraphQueryError> {
	for (const node of [
		query.from,
		query.to,
	])
		if (!index.nodes.has(node))
			return yield* Effect.fail(
				new GraphQueryError({
					reason: "missing-node",
					message: `Unknown graph node ${node}.`,
				}),
			);
	const initial: GraphFlow = {
		nodes: [
			query.from,
		],
		steps: [],
		externalPrerequisiteNodes: [],
	};
	const available = new Set([
		query.from,
	]);
	const initialPath: CausalPath = {
		flow: initial,
		available,
		unavailable: new Set(),
		visited: new Set([
			stateKeyFn(query.from, available, new Set()),
		]),
	};
	const flows: GraphFlow[] =
		query.from === query.to
			? [
					initial,
				]
			: [];
	let pending: CausalPath[] =
		query.from === query.to
			? []
			: [
					initialPath,
				];
	const reasons = new Set<GraphFlowResult["reasons"][number]>();
	const started = yield* Clock.currentTimeMillis;
	let expansions = 0;
	search: while (pending.length > 0) {
		const following: CausalPath[] = [];
		for (const path of pending) {
			const current = path.flow.nodes[path.flow.nodes.length - 1];
			for (const entry of index.outgoing.get(current) ?? []) {
				if (
					query.operationKinds !== undefined &&
					!query.operationKinds.includes(entry.operation.kind)
				)
					continue;
				for (const output of entry.outputs) {
					if (expansions >= query.maxExpansions) {
						reasons.add("expansions");
						break search;
					}
					if (expansions % 64 === 0) {
						yield* Effect.yieldNow;
						if ((yield* Clock.currentTimeMillis) - started >= query.timeoutMs) {
							reasons.add("timeout");
							break search;
						}
					}
					expansions++;
					const step = stepFn(entry, output, current);
					const next = advanceFn(path, step);
					if (next === undefined) continue;
					if (path.flow.steps.length >= query.maxDepth) {
						reasons.add("depth");
						continue;
					}
					if (step.to === query.to) flows.push(next.flow);
					else following.push(next);
				}
			}
		}
		if (flows.length >= query.limit) {
			if (flows.length > query.limit || following.length > 0) reasons.add("limit");
			break;
		}
		pending = following;
	}
	flows.sort(compareFlowsFn);
	if (flows.length > query.limit) reasons.add("limit");
	const truncated = reasons.size > 0;
	return structuredClone({
		flows: flows.slice(0, query.limit),
		status: match({
			found: flows.length > 0,
			truncated,
		})
			.with(
				{
					found: true,
				},
				() => "yes" as const,
			)
			.with(
				{
					truncated: true,
				},
				() => "unknown" as const,
			)
			.otherwise(() => "no" as const),
		truncated,
		reasons: [
			...reasons,
		].sort(),
		expansions,
	});
});
