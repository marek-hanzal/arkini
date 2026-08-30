import { Order } from "effect";

import type {
	EditorAcquisitionGraph,
	EditorAcquisitionRequirement,
	EditorAcquisitionRoute,
} from "~/flow/type/EditorAcquisitionGraph";
import type {
	EditorItemEstimate,
	EditorItemEstimateAmount,
	EditorItemEstimateDiagnostic,
	EditorItemEstimateRequirementStep,
	EditorItemEstimateRouteStep,
} from "~/estimate/domain/EditorItemEstimate";
import { editorItemEstimateMaximumQuantity } from "~/estimate/domain/EditorItemEstimateQuantitySchema";

export namespace estimateEditorItemsFn {
	export interface Props {
		readonly graph: EditorAcquisitionGraph;
		readonly requests: ReadonlyArray<{
			readonly factId: string;
			readonly quantity?: number;
		}>;
	}
}

interface RequirementGroup {
	readonly consumed: number;
	readonly factId: string;
	readonly oneTime: number;
	readonly ongoing: number;
	readonly sources: ReadonlyArray<EditorAcquisitionRequirement["source"]>;
}

interface EstimateNode {
	readonly actionRuns: number;
	readonly children: ReadonlyArray<{
		readonly group: RequirementGroup;
		readonly node: EstimateNode;
	}>;
	readonly durationMs: number;
	readonly factId: string;
	readonly outputRuns: number;
	readonly quantity: number;
	readonly rootQuantity: number;
	readonly route?: EditorAcquisitionRoute;
}

interface EstimateSuccess {
	readonly diagnostics: ReadonlyArray<EditorItemEstimateDiagnostic>;
	readonly node: EstimateNode;
	readonly status: "success";
}

interface EstimateFailure {
	readonly diagnostics: ReadonlyArray<EditorItemEstimateDiagnostic>;
	readonly status: "failure";
}

type EstimateResult = EstimateFailure | EstimateSuccess;

interface RouteSelectionSuccess {
	readonly dependencyFactIds: ReadonlySet<string>;
	readonly requirements: ReadonlyArray<EditorAcquisitionRequirement>;
	readonly route: EditorAcquisitionRoute;
	readonly status: "success";
}

type RouteSelectionResult = EstimateFailure | RouteSelectionSuccess;

interface EstimateBaseIndex {
	readonly factIds: ReadonlySet<string>;
	readonly requirementsByRoute: ReadonlyMap<
		EditorAcquisitionRoute,
		{
			readonly allOf: ReadonlyArray<EditorAcquisitionRequirement>;
			readonly anyOf: ReadonlyArray<ReadonlyArray<EditorAcquisitionRequirement>>;
		}
	>;
	readonly roots: ReadonlyMap<string, number | "unbounded">;
	readonly routesByFact: ReadonlyMap<string, ReadonlyArray<EditorAcquisitionRoute>>;
}

interface EstimateIndex extends EstimateBaseIndex {
	readonly reachableFactIds: ReadonlySet<string>;
	readonly routeSelections: ReadonlyMap<string, RouteSelectionSuccess>;
}

interface EstimateTopology {
	readonly reachableFactIds: ReadonlySet<string>;
	readonly routeSelections: ReadonlyMap<string, RouteSelectionSuccess>;
}

const maximumDiagnostics = 8;
const epsilon = 1e-9;

const uniqueDiagnostics = (diagnostics: ReadonlyArray<EditorItemEstimateDiagnostic>) => {
	const seen = new Set<string>();
	return diagnostics
		.filter((diagnostic) => {
			const key = JSON.stringify(diagnostic);
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		})
		.slice(0, maximumDiagnostics);
};

const projectRequirement = (
	requirement: EditorAcquisitionRequirement,
): EditorAcquisitionRequirement =>
	requirement.source === "charged-item"
		? {
				...requirement,
				quantity: 1,
				usage: "one-time",
			}
		: requirement;

const createIndex = (graph: EditorAcquisitionGraph): EstimateIndex => {
	const requirementsByRoute = new Map(
		graph.routes.map(
			(route) =>
				[
					route,
					{
						allOf: route.requirements.allOf.map(projectRequirement),
						anyOf: route.requirements.anyOf
							.map((clause) =>
								clause.filter(
									({ source }) =>
										source !== "line-condition" &&
										source !== "output-condition",
								),
							)
							.map((clause) => clause.map(projectRequirement))
							.filter((clause) => clause.length > 0),
					},
				] as const,
		),
	);
	const routesByFact = new Map<string, EditorAcquisitionRoute[]>();
	for (const route of graph.routes) {
		const routes = routesByFact.get(route.output.factId) ?? [];
		routes.push(route);
		routesByFact.set(route.output.factId, routes);
	}
	for (const routes of routesByFact.values())
		routes.sort((left, right) => {
			const leftDuration =
				left.output.expectedYield > epsilon
					? (left.durationMs * left.runMultiplier) / left.output.expectedYield
					: Number.POSITIVE_INFINITY;
			const rightDuration =
				right.output.expectedYield > epsilon
					? (right.durationMs * right.runMultiplier) / right.output.expectedYield
					: Number.POSITIVE_INFINITY;
			return leftDuration - rightDuration || Order.String(left.id, right.id);
		});
	const roots = new Map(
		graph.roots.map(({ factId, quantity }) => [
			factId,
			quantity,
		]),
	);
	const baseIndex: EstimateBaseIndex = {
		factIds: new Set(graph.factIds),
		requirementsByRoute,
		roots,
		routesByFact,
	};
	return {
		...baseIndex,
		...createEstimateTopology(baseIndex, graph),
	};
};

const requirementQuantity = (requirement: EditorAcquisitionRequirement, actionRuns: number) =>
	requirement.quantity * (requirement.usage === "consume" ? actionRuns : 1);

const groupRequirements = (
	requirements: ReadonlyArray<EditorAcquisitionRequirement>,
	actionRuns: number,
): ReadonlyArray<RequirementGroup> => {
	const groups = new Map<
		string,
		{
			consumed: number;
			distinctOneTime: number;
			factId: string;
			oneTime: number;
			ongoing: number;
			sources: EditorAcquisitionRequirement["source"][];
		}
	>();
	for (const requirement of requirements) {
		const group = groups.get(requirement.factId) ?? {
			consumed: 0,
			distinctOneTime: 0,
			factId: requirement.factId,
			oneTime: 0,
			ongoing: 0,
			sources: [],
		};
		if (requirement.usage === "consume")
			group.consumed += requirementQuantity(requirement, actionRuns);
		if (requirement.usage === "one-time") {
			if (requirement.identity === "distinct") group.distinctOneTime += requirement.quantity;
			else group.oneTime = Math.max(group.oneTime, requirement.quantity);
			group.oneTime = Math.max(group.oneTime, group.distinctOneTime);
		}
		if (requirement.usage === "ongoing")
			group.ongoing = Math.max(group.ongoing, requirement.quantity);
		if (!group.sources.includes(requirement.source)) {
			group.sources.push(requirement.source);
			group.sources.sort();
		}
		groups.set(group.factId, group);
	}
	return [
		...groups.values(),
	]
		.sort((left, right) => Order.String(left.factId, right.factId))
		.map(({ distinctOneTime: _distinctOneTime, ...group }) => group);
};

const readRankedRoutes = (index: EstimateBaseIndex, factId: string) =>
	index.routesByFact.get(factId) ?? [];

const createEstimateTopology = (
	index: EstimateBaseIndex,
	graph: EditorAcquisitionGraph,
): EstimateTopology => {
	const reachableFactIds = new Set(
		[
			...index.roots,
		]
			.filter(([, rootQuantity]) => rootQuantity === "unbounded" || rootQuantity > epsilon)
			.map(([rootFactId]) => rootFactId),
	);
	const routeSelections = new Map<string, RouteSelectionSuccess>();
	const readReachableRequirements = (
		route: EditorAcquisitionRoute,
	):
		| {
				readonly dependencyFactIds: ReadonlySet<string>;
				readonly requirements: ReadonlyArray<EditorAcquisitionRequirement>;
		  }
		| undefined => {
		if (!(route.output.expectedYield > epsilon)) return undefined;
		const requirements = index.requirementsByRoute.get(route)!;
		const unitActionRuns = route.runMultiplier / route.output.expectedYield;
		const rootCovers = (requirementFactId: string, requiredQuantity: number) => {
			const root = index.roots.get(requirementFactId);
			return root === "unbounded" || (root ?? 0) + epsilon >= requiredQuantity;
		};
		const readDependencies = (requirement: EditorAcquisitionRequirement) => {
			if (!reachableFactIds.has(requirement.factId)) return undefined;
			const requiredQuantity = requirementQuantity(requirement, unitActionRuns);
			if (requirement.factId === route.output.factId)
				return requirement.usage !== "consume" &&
					rootCovers(requirement.factId, requiredQuantity)
					? new Set<string>()
					: undefined;
			if (requirement.usage !== "consume" && rootCovers(requirement.factId, requiredQuantity))
				return new Set<string>();
			const dependencies = new Set([
				requirement.factId,
			]);
			if (!rootCovers(requirement.factId, requiredQuantity)) {
				const selection = routeSelections.get(requirement.factId);
				if (selection === undefined) return undefined;
				for (const dependencyFactId of selection.dependencyFactIds)
					dependencies.add(dependencyFactId);
			}
			return dependencies.has(route.output.factId) ? undefined : dependencies;
		};
		const dependencyFactIds = new Set<string>();
		for (const requirement of requirements.allOf) {
			const dependencies = readDependencies(requirement);
			if (dependencies === undefined) return undefined;
			for (const dependencyFactId of dependencies) dependencyFactIds.add(dependencyFactId);
		}
		const selectedRequirements = [
			...requirements.allOf,
		];
		for (const clause of requirements.anyOf) {
			const selected = [
				...clause,
			]
				.sort((left, right) => Order.String(left.factId, right.factId))
				.map((requirement) => ({
					dependencies: readDependencies(requirement),
					requirement,
				}))
				.find(({ dependencies }) => dependencies !== undefined);
			if (selected === undefined) return undefined;
			selectedRequirements.push(selected.requirement);
			for (const dependencyFactId of selected.dependencies!)
				dependencyFactIds.add(dependencyFactId);
		}
		for (const group of groupRequirements(selectedRequirements, unitActionRuns)) {
			const requiredQuantity = group.consumed + Math.max(group.oneTime, group.ongoing);
			if (group.factId === route.output.factId) {
				if (group.consumed > epsilon || !rootCovers(group.factId, requiredQuantity))
					return undefined;
				continue;
			}
			if (rootCovers(group.factId, requiredQuantity)) continue;
			const selection = routeSelections.get(group.factId);
			if (selection === undefined) return undefined;
			dependencyFactIds.add(group.factId);
			for (const dependencyFactId of selection.dependencyFactIds)
				dependencyFactIds.add(dependencyFactId);
			if (dependencyFactIds.has(route.output.factId)) return undefined;
		}
		return {
			dependencyFactIds,
			requirements: selectedRequirements,
		};
	};
	for (let depth = 0; depth < graph.factIds.length; depth += 1) {
		const additions = new Set<string>();
		let selectedRoute = false;
		for (const currentFactId of [
			...graph.factIds,
		].sort()) {
			if (routeSelections.has(currentFactId)) continue;
			for (const route of readRankedRoutes(index, currentFactId)) {
				const reachable = readReachableRequirements(route);
				if (reachable === undefined) continue;
				routeSelections.set(currentFactId, {
					dependencyFactIds: reachable.dependencyFactIds,
					requirements: reachable.requirements,
					route,
					status: "success",
				});
				selectedRoute = true;
				if (!reachableFactIds.has(currentFactId)) additions.add(currentFactId);
				break;
			}
		}
		if (additions.size === 0 && !selectedRoute) break;
		for (const addedFactId of additions) reachableFactIds.add(addedFactId);
	}
	return {
		reachableFactIds,
		routeSelections,
	};
};

const nodeProducesAnyFact = (root: EstimateNode, factIds: ReadonlySet<string>): boolean => {
	const pending = [
		root,
	];
	const visited = new Set<EstimateNode>();
	while (pending.length > 0) {
		const node = pending.pop()!;
		if (visited.has(node)) continue;
		visited.add(node);
		if (node.route !== undefined && factIds.has(node.factId)) return true;
		for (const { node: child } of node.children) pending.push(child);
	}
	return false;
};

interface EstimateNodeGraph {
	readonly nodes: ReadonlyArray<EstimateNode>;
	readonly occurrenceCountByNode: ReadonlyMap<EstimateNode, number>;
	readonly occurrenceIdByNode: ReadonlyMap<EstimateNode, string>;
}

const createEstimateNodeGraph = (root: EstimateNode): EstimateNodeGraph => {
	const discovered = [
		root,
	];
	const discoveryIndex = new Map<EstimateNode, number>([
		[
			root,
			0,
		],
	]);
	for (let index = 0; index < discovered.length; index += 1)
		for (const { node: child } of discovered[index]!.children)
			if (!discoveryIndex.has(child)) {
				discoveryIndex.set(child, discovered.length);
				discovered.push(child);
			}

	const incomingCount = new Map(
		discovered.map((node) => [
			node,
			0,
		]),
	);
	for (const node of discovered)
		for (const { node: child } of node.children)
			incomingCount.set(child, (incomingCount.get(child) ?? 0) + 1);
	const ready = discovered.filter((node) => incomingCount.get(node) === 0);
	const nodes: EstimateNode[] = [];
	const occurrenceCountByNode = new Map<EstimateNode, number>([
		[
			root,
			1,
		],
	]);
	while (ready.length > 0) {
		ready.sort((left, right) => discoveryIndex.get(left)! - discoveryIndex.get(right)!);
		const node = ready.shift()!;
		nodes.push(node);
		const occurrenceCount = occurrenceCountByNode.get(node) ?? 0;
		for (const { node: child } of node.children) {
			occurrenceCountByNode.set(
				child,
				(occurrenceCountByNode.get(child) ?? 0) + occurrenceCount,
			);
			const remaining = (incomingCount.get(child) ?? 0) - 1;
			incomingCount.set(child, remaining);
			if (remaining === 0) ready.push(child);
		}
	}
	if (nodes.length !== discovered.length)
		throw new Error("Estimate materialization produced a cyclic node graph.");
	return {
		nodes,
		occurrenceCountByNode,
		occurrenceIdByNode: new Map(
			discovered.map((node, index) => [
				node,
				index === 0 ? "target" : `group:${index}:${node.factId}`,
			]),
		),
	};
};

const projectRouteSteps = ({
	nodes,
	occurrenceCountByNode,
	occurrenceIdByNode,
}: EstimateNodeGraph): ReadonlyArray<EditorItemEstimateRouteStep> =>
	nodes.map((node) => {
		const requirements: EditorItemEstimateRequirementStep[] = [];
		for (const { group, node: child } of node.children) {
			let first = true;
			for (const [usage, quantity] of [
				[
					"consume",
					group.consumed,
				],
				[
					"one-time",
					group.oneTime,
				],
				[
					"ongoing",
					group.ongoing,
				],
			] as const) {
				if (quantity <= epsilon) continue;
				requirements.push({
					acquisitionOccurrenceId: first ? occurrenceIdByNode.get(child) : undefined,
					factId: group.factId,
					quantity,
					sources: group.sources,
					usage,
				});
				first = false;
			}
		}
		return {
			actionRuns: node.actionRuns,
			durationMs: node.route === undefined ? 0 : node.route.durationMs * node.actionRuns,
			factId: node.factId,
			...(node.route === undefined
				? {}
				: {
						metadata: node.route.metadata,
					}),
			occurrenceCount: occurrenceCountByNode.get(node) ?? 1,
			occurrenceId: occurrenceIdByNode.get(node)!,
			outputRuns: node.outputRuns,
			quantity: node.quantity,
			requirements,
			rootQuantity: node.rootQuantity,
			routeId: node.route?.id ?? `root:${node.factId}`,
			source: node.route === undefined ? "root" : "route",
		};
	});

const readRequirementSummary = ({ nodes, occurrenceCountByNode }: EstimateNodeGraph) => {
	const consumed = new Map<string, number>();
	const oneTime = new Map<string, number>();
	const ongoing = new Map<string, number>();
	for (const node of nodes) {
		const occurrenceCount = occurrenceCountByNode.get(node) ?? 1;
		for (const { group } of node.children) {
			consumed.set(
				group.factId,
				(consumed.get(group.factId) ?? 0) + group.consumed * occurrenceCount,
			);
			oneTime.set(
				group.factId,
				Math.max(oneTime.get(group.factId) ?? 0, group.oneTime * occurrenceCount),
			);
			ongoing.set(
				group.factId,
				Math.max(ongoing.get(group.factId) ?? 0, group.ongoing * occurrenceCount),
			);
		}
	}
	const freeze = (
		quantities: ReadonlyMap<string, number>,
	): ReadonlyArray<EditorItemEstimateAmount> =>
		[
			...quantities,
		]
			.filter(([, amount]) => amount > epsilon)
			.sort(([left], [right]) => Order.String(left, right))
			.map(([amountFactId, amount]) => ({
				factId: amountFactId,
				quantity: amount,
			}));
	return {
		consumed: freeze(consumed),
		oneTime: freeze(oneTime),
		ongoing: freeze(ongoing),
	};
};

/** Builds one topology and projects deterministic scalar estimates for the requested authored facts. */
export const estimateEditorItemsFn = ({
	graph,
	requests,
}: estimateEditorItemsFn.Props): ReadonlyArray<EditorItemEstimate> => {
	if (requests.length === 0) return [];
	const index = createIndex(graph);
	return requests.map(({ factId, quantity = 1 }): EditorItemEstimate => {
		if (quantity > editorItemEstimateMaximumQuantity)
			return {
				diagnostics: [
					{
						factId,
						kind: "quantity-limit-exceeded",
						maximumQuantity: editorItemEstimateMaximumQuantity,
						quantity,
						source: "request",
					},
				],
				factId,
				limitations: graph.limitations,
				obtainable: false,
				quantity,
				status: "partial",
			};
		if (!(quantity > 0) || !index.factIds.has(factId))
			return {
				diagnostics: [
					{
						factId,
						kind: "unreachable",
						quantity,
					},
				],
				factId,
				limitations: graph.limitations,
				obtainable: false,
				quantity,
				status: "unreachable",
			};

		const cycleFailure = (
			cycleFactId: string,
			activeFactIds: ReadonlyArray<string>,
			routeId: string,
		): EstimateFailure => {
			const cycleIndex = activeFactIds.indexOf(cycleFactId);
			return {
				diagnostics: [
					{
						factIds: [
							...activeFactIds.slice(cycleIndex),
							cycleFactId,
						],
						kind: "cycle",
						routeId,
					},
				],
				status: "failure",
			};
		};
		const traceUnavailable = (
			currentFactId: string,
			activeFactIds: ReadonlyArray<string>,
			diagnosticRouteId?: string,
		): EstimateFailure => {
			const route = readRankedRoutes(index, currentFactId).find(
				(candidate) => candidate.output.expectedYield > epsilon,
			);
			if (route === undefined) {
				const zeroYieldRoute = readRankedRoutes(index, currentFactId)[0];
				return {
					diagnostics: [
						zeroYieldRoute === undefined
							? {
									factId: currentFactId,
									kind: "unreachable",
									quantity: 1,
									...(diagnosticRouteId === undefined
										? {}
										: {
												routeId: diagnosticRouteId,
											}),
								}
							: {
									factId: currentFactId,
									kind: "zero-yield",
									routeId: zeroYieldRoute.id,
								},
					],
					status: "failure",
				};
			}
			const requirements = index.requirementsByRoute.get(route)!;
			const isUnavailable = (requirement: EditorAcquisitionRequirement) =>
				!index.reachableFactIds.has(requirement.factId) ||
				(requirement.usage === "consume" && requirement.factId === currentFactId);
			const missingClause = requirements.anyOf.find((clause) => clause.every(isUnavailable));
			const missingRequirement =
				requirements.allOf.find(isUnavailable) ??
				(missingClause === undefined
					? undefined
					: [
							...missingClause,
						].sort((left, right) => Order.String(left.factId, right.factId))[0]);
			if (missingRequirement === undefined)
				return {
					diagnostics: [
						{
							factId: currentFactId,
							kind: "unreachable",
							quantity: 1,
							routeId: diagnosticRouteId ?? route.id,
						},
					],
					status: "failure",
				};
			const branch = [
				...activeFactIds,
				currentFactId,
			];
			const topRouteId = diagnosticRouteId ?? route.id;
			if (branch.includes(missingRequirement.factId))
				return cycleFailure(missingRequirement.factId, branch, topRouteId);
			return traceUnavailable(missingRequirement.factId, branch, topRouteId);
		};
		const selectProduction = (
			currentFactId: string,
			activeFactIds: ReadonlyArray<string>,
			diagnosticRouteId?: string,
		): RouteSelectionResult => {
			const activeIndex = activeFactIds.indexOf(currentFactId);
			if (activeIndex >= 0)
				return cycleFailure(
					currentFactId,
					activeFactIds,
					diagnosticRouteId ??
						index.routesByFact.get(currentFactId)?.[0]?.id ??
						`unreachable:${currentFactId}`,
				);
			const selected = index.routeSelections.get(currentFactId);
			return selected ?? traceUnavailable(currentFactId, activeFactIds, diagnosticRouteId);
		};

		const materializedMemo = new Map<string, EstimateSuccess>();
		const solveFact = (
			currentFactId: string,
			currentQuantity: number,
			activeFactIds: ReadonlyArray<string>,
			diagnosticRouteId?: string,
		): EstimateResult => {
			if (currentQuantity > editorItemEstimateMaximumQuantity)
				return {
					diagnostics: [
						{
							factId: currentFactId,
							kind: "quantity-limit-exceeded",
							maximumQuantity: editorItemEstimateMaximumQuantity,
							quantity: currentQuantity,
							source: "authored-demand",
						},
					],
					status: "failure",
				};
			const memoKey = JSON.stringify([
				currentFactId,
				currentQuantity,
			]);
			const memoized = materializedMemo.get(memoKey);
			if (
				memoized !== undefined &&
				!nodeProducesAnyFact(memoized.node, new Set(activeFactIds))
			)
				return memoized;
			const root = index.roots.get(currentFactId);
			const rootQuantity =
				root === "unbounded" ? currentQuantity : Math.min(root ?? 0, currentQuantity);
			const missingQuantity = Math.max(0, currentQuantity - rootQuantity);
			if (missingQuantity <= epsilon) {
				const success: EstimateSuccess = {
					diagnostics: [],
					node: {
						actionRuns: 0,
						children: [],
						durationMs: 0,
						factId: currentFactId,
						outputRuns: 0,
						quantity: currentQuantity,
						rootQuantity,
					},
					status: "success",
				};
				materializedMemo.set(memoKey, success);
				return success;
			}
			const cycleIndex = activeFactIds.indexOf(currentFactId);
			if (cycleIndex >= 0)
				return cycleFailure(
					currentFactId,
					activeFactIds,
					diagnosticRouteId ??
						index.routesByFact.get(currentFactId)?.[0]?.id ??
						`unreachable:${currentFactId}`,
				);
			const selection = selectProduction(currentFactId, activeFactIds, diagnosticRouteId);
			if (selection.status === "failure") return selection;
			const outputRuns = missingQuantity / selection.route.output.expectedYield;
			const actionRuns = outputRuns * selection.route.runMultiplier;
			const children: EstimateNode["children"][number][] = [];
			const diagnostics: EditorItemEstimateDiagnostic[] = [];
			for (const group of groupRequirements(selection.requirements, actionRuns)) {
				const requiredQuantity = group.consumed + Math.max(group.oneTime, group.ongoing);
				const branch = [
					...activeFactIds,
					currentFactId,
				];
				if (group.consumed > epsilon && branch.includes(group.factId))
					return cycleFailure(
						group.factId,
						branch,
						diagnosticRouteId ?? selection.route.id,
					);
				const child = solveFact(
					group.factId,
					requiredQuantity,
					branch,
					diagnosticRouteId ?? selection.route.id,
				);
				if (child.status === "failure")
					return {
						diagnostics: uniqueDiagnostics([
							...child.diagnostics,
							{
								factId: currentFactId,
								kind: "quantity-specific-route-not-retried",
								quantity: currentQuantity,
								routeId: selection.route.id,
							},
						]),
						status: "failure",
					};
				diagnostics.push(...child.diagnostics);
				children.push({
					group,
					node: child.node,
				});
			}
			const success: EstimateSuccess = {
				diagnostics: uniqueDiagnostics(diagnostics),
				node: {
					actionRuns,
					children,
					durationMs:
						selection.route.durationMs * actionRuns +
						Math.max(0, ...children.map(({ node }) => node.durationMs)),
					factId: currentFactId,
					outputRuns,
					quantity: currentQuantity,
					rootQuantity,
					route: selection.route,
				},
				status: "success",
			};
			materializedMemo.set(memoKey, success);
			return success;
		};

		const result = solveFact(factId, quantity, []);
		if (result.status === "failure") {
			const diagnostics = uniqueDiagnostics(result.diagnostics).slice(0, maximumDiagnostics);
			return {
				diagnostics,
				factId,
				limitations: graph.limitations,
				obtainable: false,
				quantity,
				status: diagnostics.some(
					({ kind }) =>
						kind === "quantity-limit-exceeded" ||
						kind === "quantity-specific-route-not-retried",
				)
					? "partial"
					: "unreachable",
			};
		}
		const nodeGraph = createEstimateNodeGraph(result.node);
		const routeSteps = projectRouteSteps(nodeGraph);
		return {
			diagnostics: uniqueDiagnostics(result.diagnostics).slice(0, maximumDiagnostics),
			durationMs: result.node.durationMs,
			factId,
			limitations: graph.limitations,
			obtainable: true,
			quantity,
			requirementSummary: readRequirementSummary(nodeGraph),
			route: routeSteps[0]!,
			routeSteps,
			status: "complete",
		};
	});
};
