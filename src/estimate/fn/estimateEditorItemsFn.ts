import { Graph, Order } from "effect";

import type {
	EditorAcquisitionGraph,
	EditorAcquisitionRequirement,
	EditorAcquisitionRoute,
} from "~/flow/type/EditorAcquisitionGraph";
import {
	groupEstimateRequirementsFn,
	readEstimateRequirementQuantityFn,
} from "~/estimate-demand/fn/groupEstimateRequirementsFn";
import { projectEstimateWitnessFn } from "~/estimate-projection/fn/projectEstimateWitnessFn";
import type {
	EditorItemEstimate,
	EditorItemEstimateDiagnostic,
} from "~/estimate/type/EditorItemEstimate";
import { editorItemEstimateMaximumQuantity } from "~/estimate/schema/EditorItemEstimateQuantitySchema";
import type { EstimateWitnessNode } from "~/estimate-witness/type/EstimateWitnessNode";

interface EstimateEditorItemsProps {
	readonly graph: EditorAcquisitionGraph;
	readonly requests: ReadonlyArray<{
		readonly factId: string;
		readonly quantity?: number;
	}>;
}

interface EstimateSuccess {
	readonly diagnostics: ReadonlyArray<EditorItemEstimateDiagnostic>;
	readonly node: EstimateWitnessNode;
	readonly status: "success";
}

interface EstimateFailure {
	readonly diagnostics: ReadonlyArray<EditorItemEstimateDiagnostic>;
	readonly status: "failure";
}

type EstimateResult = EstimateFailure | EstimateSuccess;

interface EstimateBaseIndex {
	readonly componentByFact: ReadonlyMap<string, string>;
	readonly factCount: number;
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
}

const maximumDiagnostics = 8;
// States are normalized grouped demands. Exceeding this bound reports partial instead of
// silently dropping an incomparable complete alternative and claiming a false optimum.
const maximumAnyOfRequirementSelections = 64;
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

const readComponentByFactFn = (
	graph: EditorAcquisitionGraph,
	requirementsByRoute: EstimateBaseIndex["requirementsByRoute"],
) => {
	const nodeByFact = new Map<string, Graph.NodeIndex>();
	const factByNode = new Map<Graph.NodeIndex, string>();
	const dependencyGraph = Graph.directed<string, void>((mutable) => {
		for (const factId of [
			...new Set(graph.factIds),
		].sort(Order.String)) {
			const node = Graph.addNode(mutable, factId);
			nodeByFact.set(factId, node);
			factByNode.set(node, factId);
		}
		for (const route of graph.routes)
			for (const requirement of [
				...(requirementsByRoute.get(route)?.allOf ?? []),
				...(requirementsByRoute.get(route)?.anyOf ?? []).flat(),
			]) {
				const from = nodeByFact.get(route.output.factId);
				const to = nodeByFact.get(requirement.factId);
				if (from !== undefined && to !== undefined)
					Graph.addEdge(mutable, from, to, undefined);
			}
	});
	const componentByFact = new Map<string, string>();
	for (const component of Graph.stronglyConnectedComponents(dependencyGraph)) {
		const factIds = component
			.map((node) => factByNode.get(node))
			.filter((factId): factId is string => factId !== undefined)
			.sort(Order.String);
		const componentId = factIds[0];
		if (componentId !== undefined)
			for (const factId of factIds) componentByFact.set(factId, componentId);
	}
	return componentByFact;
};

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
		componentByFact: readComponentByFactFn(graph, requirementsByRoute),
		factCount: graph.factIds.length,
		factIds: new Set(graph.factIds),
		requirementsByRoute,
		roots,
		routesByFact,
	};
	return {
		...baseIndex,
		reachableFactIds: readCompleteFactIdsFn(baseIndex, graph),
	};
};

const readRankedRoutes = (index: EstimateBaseIndex, factId: string) =>
	index.routesByFact.get(factId) ?? [];

function readCompleteFactIdsFn(
	index: EstimateBaseIndex,
	graph: EditorAcquisitionGraph,
	blockedFactId?: string,
) {
	const complete = new Set(graph.roots.map(({ factId }) => factId));
	let pending = graph.routes.filter(
		(route) => route.output.factId !== blockedFactId && route.output.expectedYield > epsilon,
	);
	for (let iteration = 0; iteration < index.factCount; iteration += 1) {
		let changed = false;
		const nextPending: EditorAcquisitionRoute[] = [];
		for (const route of pending) {
			const requirements = index.requirementsByRoute.get(route)!;
			if (
				requirements.allOf.some(({ factId }) => !complete.has(factId)) ||
				requirements.anyOf.some(
					(clause) => !clause.some(({ factId }) => complete.has(factId)),
				)
			)
				nextPending.push(route);
			else if (!complete.has(route.output.factId)) {
				complete.add(route.output.factId);
				changed = true;
			}
		}
		if (!changed) break;
		pending = nextPending;
	}
	return complete;
}

const nodeProducesAnyFact = (root: EstimateWitnessNode, factIds: ReadonlySet<string>): boolean => {
	const pending = [
		root,
	];
	const visited = new Set<EstimateWitnessNode>();
	while (pending.length > 0) {
		const node = pending.pop()!;
		if (visited.has(node)) continue;
		visited.add(node);
		if (node.route !== undefined && factIds.has(node.factId)) return true;
		for (const { node: child } of node.children) pending.push(child);
	}
	return false;
};

const readRetainedQuantityByFactFn = (root: EstimateWitnessNode) => {
	const retainedQuantityByFact = new Map<string, number>();
	const pending = [
		root,
	];
	const visited = new Set<EstimateWitnessNode>();
	while (pending.length > 0) {
		const node = pending.pop()!;
		if (visited.has(node)) continue;
		visited.add(node);
		for (const { group, node: child } of node.children) {
			if (group.consumed <= epsilon)
				retainedQuantityByFact.set(
					group.factId,
					Math.max(
						retainedQuantityByFact.get(group.factId) ?? 0,
						group.oneTime,
						group.ongoing,
					),
				);
			pending.push(child);
		}
	}
	return retainedQuantityByFact;
};

/** Builds one topology and projects deterministic scalar estimates for the requested authored facts. */
export const estimateEditorItemsFn = ({
	graph,
	requests,
}: EstimateEditorItemsProps): ReadonlyArray<EditorItemEstimate> => {
	if (requests.length === 0) return [];
	const index = createIndex(graph);
	const completeFactsByBlockedFactId = new Map<string, ReadonlySet<string>>();
	const readCompleteFacts = (blockedFactId?: string) => {
		const key = blockedFactId ?? "";
		const memoized = completeFactsByBlockedFactId.get(key);
		if (memoized !== undefined) return memoized;
		const complete = readCompleteFactIdsFn(index, graph, blockedFactId);
		completeFactsByBlockedFactId.set(key, complete);
		return complete;
	};
	const isCompleteRoute = (route: EditorAcquisitionRoute) => {
		if (!(route.output.expectedYield > epsilon)) return false;
		const requirements = index.requirementsByRoute.get(route)!;
		const satisfies = (complete: ReadonlySet<string>) =>
			requirements.allOf.every(({ factId }) => complete.has(factId)) &&
			requirements.anyOf.every((clause) => clause.some(({ factId }) => complete.has(factId)));
		if (!satisfies(readCompleteFacts())) return false;
		const outputComponent =
			index.componentByFact.get(route.output.factId) ?? route.output.factId;
		const mayReenterOutputComponent = [
			...requirements.allOf,
			...requirements.anyOf.flat(),
		].some(({ factId }) => (index.componentByFact.get(factId) ?? factId) === outputComponent);
		return !mayReenterOutputComponent || satisfies(readCompleteFacts(route.output.factId));
	};
	// Cyclic components need a finite scalar ordering hint; only materialized witnesses decide.
	const unitCost = new Map<string, number>();
	for (const { factId } of graph.roots) unitCost.set(factId, 0);
	for (let iteration = 0; iteration < index.factCount; iteration += 1) {
		let changed = false;
		for (const route of graph.routes) {
			if (!(route.output.expectedYield > epsilon)) continue;
			const actionRuns = route.runMultiplier / route.output.expectedYield;
			const requirements = index.requirementsByRoute.get(route)!;
			const readUnitRequirementCost = (requirement: EditorAcquisitionRequirement) => {
				const cost = unitCost.get(requirement.factId);
				return cost === undefined
					? Number.POSITIVE_INFINITY
					: cost * readEstimateRequirementQuantityFn(requirement, actionRuns);
			};
			let dependencyCost = Math.max(0, ...requirements.allOf.map(readUnitRequirementCost));
			for (const clause of requirements.anyOf)
				dependencyCost = Math.max(
					dependencyCost,
					Math.min(...clause.map(readUnitRequirementCost)),
				);
			const cost = route.durationMs * actionRuns + dependencyCost;
			const current = unitCost.get(route.output.factId);
			if (Number.isFinite(cost) && (current === undefined || cost < current - epsilon)) {
				unitCost.set(route.output.factId, cost);
				changed = true;
			}
		}
		if (!changed) break;
	}
	const quantityCostMemo = new Map<string, number>();
	const readMissingQuantity = (factId: string, quantity: number) => {
		const root = index.roots.get(factId);
		return root === "unbounded" ? 0 : Math.max(0, quantity - (root ?? 0));
	};
	function readFactCost(factId: string, quantity: number, activeComponentId: string): number {
		if (quantity > editorItemEstimateMaximumQuantity) return Number.POSITIVE_INFINITY;
		const missingQuantity = readMissingQuantity(factId, quantity);
		if (missingQuantity <= epsilon) return 0;
		const componentId = index.componentByFact.get(factId) ?? factId;
		if (componentId === activeComponentId)
			return (unitCost.get(factId) ?? Number.POSITIVE_INFINITY) * missingQuantity;
		const memoKey = JSON.stringify([
			factId,
			Math.round(missingQuantity * 1e9) / 1e9,
			activeComponentId,
		]);
		const memoized = quantityCostMemo.get(memoKey);
		if (memoized !== undefined) return memoized;
		const cost = Math.min(
			...readRankedRoutes(index, factId)
				.filter(isCompleteRoute)
				.map((route) => readRouteCost(route, missingQuantity, componentId).durationMs),
		);
		quantityCostMemo.set(memoKey, cost);
		return cost;
	}
	function readSelectedRequirements(
		route: EditorAcquisitionRoute,
		actionRuns: number,
		activeComponentId: string,
	) {
		const requirements = index.requirementsByRoute.get(route)!;
		const selected = [
			...requirements.allOf,
		];
		for (const clause of requirements.anyOf) {
			const alternative = [
				...clause,
			].sort((left, right) => {
				const leftCost = readFactCost(
					left.factId,
					readEstimateRequirementQuantityFn(left, actionRuns),
					activeComponentId,
				);
				const rightCost = readFactCost(
					right.factId,
					readEstimateRequirementQuantityFn(right, actionRuns),
					activeComponentId,
				);
				return leftCost - rightCost || Order.String(left.factId, right.factId);
			})[0];
			if (alternative === undefined) return undefined;
			selected.push(alternative);
		}
		return selected;
	}
	function readRouteCost(
		route: EditorAcquisitionRoute,
		missingQuantity: number,
		activeComponentId: string,
	) {
		if (!isCompleteRoute(route))
			return {
				durationMs: Number.POSITIVE_INFINITY,
			};
		const outputRuns = missingQuantity / route.output.expectedYield;
		const actionRuns = outputRuns * route.runMultiplier;
		const requirements = readSelectedRequirements(route, actionRuns, activeComponentId);
		if (requirements === undefined)
			return {
				durationMs: Number.POSITIVE_INFINITY,
			};
		let dependencyDurationMs = 0;
		for (const group of groupEstimateRequirementsFn(requirements, actionRuns)) {
			const cost = readFactCost(
				group.factId,
				group.consumed + Math.max(group.oneTime, group.ongoing),
				activeComponentId,
			);
			if (!Number.isFinite(cost))
				return {
					durationMs: cost,
					requirements,
				};
			dependencyDurationMs = Math.max(dependencyDurationMs, cost);
		}
		return {
			durationMs: route.durationMs * actionRuns + dependencyDurationMs,
			requirements,
		};
	}
	const readCostedRoutes = (factId: string, quantity: number) => {
		const missingQuantity = readMissingQuantity(factId, quantity);
		if (missingQuantity <= epsilon) return [];
		const activeComponentId = index.componentByFact.get(factId) ?? factId;
		const candidates: Array<{
			readonly durationMs: number;
			readonly route: EditorAcquisitionRoute;
		}> = [];
		for (const route of readRankedRoutes(index, factId)) {
			const cost = readRouteCost(route, missingQuantity, activeComponentId);
			if (cost.requirements === undefined) continue;
			candidates.push({
				durationMs: cost.durationMs,
				route,
			});
		}
		return candidates.sort(
			(left, right) =>
				left.durationMs - right.durationMs || Order.String(left.route.id, right.route.id),
		);
	};
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
		let retainedQuantityByFact = new Map<string, number>();
		let materializedMemo = new Map<string, EstimateSuccess[]>();
		const rememberMaterialized = (memoKey: string, success: EstimateSuccess) => {
			const candidates = materializedMemo.get(memoKey) ?? [];
			if (!candidates.some(({ node }) => node === success.node)) candidates.push(success);
			candidates.sort(
				(left, right) =>
					left.node.durationMs - right.node.durationMs ||
					Order.String(left.node.route?.id ?? "", right.node.route?.id ?? ""),
			);
			materializedMemo.set(memoKey, candidates);
		};
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
			const activeFactIdSet = new Set(activeFactIds);
			const memoized = materializedMemo
				.get(memoKey)
				?.find(({ node }) => !nodeProducesAnyFact(node, activeFactIdSet));
			if (memoized !== undefined) return memoized;
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
				rememberMaterialized(memoKey, success);
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
			const branch = [
				...activeFactIds,
				currentFactId,
			];
			const selections = readCostedRoutes(currentFactId, currentQuantity);
			if (selections.length === 0)
				return traceUnavailable(currentFactId, activeFactIds, diagnosticRouteId);
			const failures: EditorItemEstimateDiagnostic[] = [];
			let best: EstimateSuccess | undefined;
			let bestRequirementSelectionKey = "";
			for (const selection of selections) {
				const outputRuns = missingQuantity / selection.route.output.expectedYield;
				const actionRuns = outputRuns * selection.route.runMultiplier;
				const routeRequirements = index.requirementsByRoute.get(selection.route)!;
				const activeComponentId = index.componentByFact.get(currentFactId) ?? currentFactId;
				const rankedClauses = routeRequirements.anyOf.map((clause) =>
					[
						...clause,
					].sort((left, right) => {
						const leftCost = readFactCost(
							left.factId,
							readEstimateRequirementQuantityFn(left, actionRuns),
							activeComponentId,
						);
						const rightCost = readFactCost(
							right.factId,
							readEstimateRequirementQuantityFn(right, actionRuns),
							activeComponentId,
						);
						return leftCost - rightCost || Order.String(left.factId, right.factId);
					}),
				);
				function materializeRequirements(
					requirements: ReadonlyArray<EditorAcquisitionRequirement>,
				) {
					const children: EstimateWitnessNode["children"][number][] = [];
					const diagnostics: EditorItemEstimateDiagnostic[] = [];
					for (const group of groupEstimateRequirementsFn(requirements, actionRuns)) {
						if (group.consumed > epsilon && branch.includes(group.factId))
							return {
								diagnostics: cycleFailure(
									group.factId,
									branch,
									diagnosticRouteId ?? selection.route.id,
								).diagnostics,
								failedFactId: group.factId,
							};
						// Consumed and retained demand have different sharing laws and cannot share one edge.
						if (group.consumed > epsilon) {
							const child = solveFact(
								group.factId,
								group.consumed,
								branch,
								diagnosticRouteId ?? selection.route.id,
							);
							if (child.status === "failure")
								return {
									diagnostics: child.diagnostics,
									failedFactId: group.factId,
								};
							diagnostics.push(...child.diagnostics);
							children.push({
								group: {
									...group,
									oneTime: 0,
									ongoing: 0,
								},
								node: child.node,
							});
						}
						const retainedQuantity = Math.max(group.oneTime, group.ongoing);
						if (retainedQuantity > epsilon) {
							const child = solveFact(
								group.factId,
								Math.max(
									retainedQuantity,
									retainedQuantityByFact.get(group.factId) ?? 0,
								),
								branch,
								diagnosticRouteId ?? selection.route.id,
							);
							if (child.status === "failure")
								return {
									diagnostics: child.diagnostics,
									failedFactId: group.factId,
								};
							diagnostics.push(...child.diagnostics);
							children.push({
								group: {
									...group,
									consumed: 0,
								},
								node: child.node,
							});
						}
					}
					return {
						children,
						diagnostics,
						failedFactId: undefined,
					};
				}
				const readRequirementSelections = () => {
					type RequirementSelection = {
						readonly groups: ReturnType<typeof groupEstimateRequirementsFn>;
						readonly key: string;
						readonly requirements: ReadonlyArray<EditorAcquisitionRequirement>;
					};
					const readGroupsKey = (groups: RequirementSelection["groups"]) =>
						JSON.stringify(
							groups.map(
								({ consumed, distinctOneTime, factId, oneTime, ongoing }) => [
									factId,
									consumed,
									distinctOneTime,
									oneTime,
									ongoing,
								],
							),
						);
					const readSelectionKey = (
						requirements: ReadonlyArray<EditorAcquisitionRequirement>,
					) =>
						JSON.stringify(
							requirements.map(({ factId, identity, quantity, source, usage }) => [
								factId,
								identity,
								quantity,
								source,
								usage,
							]),
						);
					const dominates = (left: RequirementSelection, right: RequirementSelection) => {
						const rightGroupByFact = new Map(
							right.groups.map((group) => [
								group.factId,
								group,
							]),
						);
						const leftGroupByFact = new Map(
							left.groups.map((group) => [
								group.factId,
								group,
							]),
						);
						let strictlyLower = false;
						for (const factId of new Set([
							...leftGroupByFact.keys(),
							...rightGroupByFact.keys(),
						])) {
							const leftGroup = leftGroupByFact.get(factId);
							const rightGroup = rightGroupByFact.get(factId);
							for (const key of [
								"consumed",
								"distinctOneTime",
								"oneTime",
								"ongoing",
							] as const) {
								const leftQuantity = leftGroup?.[key] ?? 0;
								const rightQuantity = rightGroup?.[key] ?? 0;
								if (leftQuantity > rightQuantity + epsilon) return false;
								if (leftQuantity < rightQuantity - epsilon) strictlyLower = true;
							}
						}
						return strictlyLower;
					};
					const readRank = (selection: RequirementSelection) =>
						Math.max(
							0,
							...selection.groups.map(({ consumed, factId, oneTime, ongoing }) =>
								readFactCost(
									factId,
									consumed + Math.max(oneTime, ongoing),
									activeComponentId,
								),
							),
						);
					let selections: ReadonlyArray<RequirementSelection> = [
						{
							groups: groupEstimateRequirementsFn(
								routeRequirements.allOf,
								actionRuns,
							),
							key: readSelectionKey(routeRequirements.allOf),
							requirements: routeRequirements.allOf,
						},
					];
					for (const clause of rankedClauses) {
						const nextByGroupsKey = new Map<string, RequirementSelection>();
						let exceededMaximum = false;
						for (const current of selections) {
							if (exceededMaximum) break;
							for (const alternative of clause) {
								const requirements = [
									...current.requirements,
									alternative,
								];
								const groups = groupEstimateRequirementsFn(
									requirements,
									actionRuns,
								);
								const candidate = {
									groups,
									key: readSelectionKey(requirements),
									requirements,
								};
								const groupsKey = readGroupsKey(groups);
								const currentCandidate = nextByGroupsKey.get(groupsKey);
								if (
									currentCandidate === undefined ||
									candidate.key < currentCandidate.key
								)
									nextByGroupsKey.set(groupsKey, candidate);
								if (nextByGroupsKey.size > maximumAnyOfRequirementSelections) {
									exceededMaximum = true;
									break;
								}
							}
						}
						if (exceededMaximum)
							return {
								exceededMaximum: true,
								selections: [],
							};
						const candidates = [
							...nextByGroupsKey.values(),
						];
						const nonDominated = candidates
							.filter(
								(candidate) =>
									!candidates.some((other) => dominates(other, candidate)),
							)
							.sort(
								(left, right) =>
									readRank(left) - readRank(right) ||
									Order.String(left.key, right.key),
							);
						if (nonDominated.length > maximumAnyOfRequirementSelections)
							return {
								exceededMaximum: true,
								selections: [],
							};
						selections = nonDominated;
					}
					return {
						exceededMaximum: false,
						selections,
					};
				};
				const requirementSelections = readRequirementSelections();
				if (requirementSelections.exceededMaximum) {
					failures.push({
						factId: currentFactId,
						kind: "any-of-selection-limit-exceeded",
						maximumSelections: maximumAnyOfRequirementSelections,
						routeId: selection.route.id,
					});
					continue;
				}
				for (const requirementSelection of requirementSelections.selections) {
					const materialized = materializeRequirements(requirementSelection.requirements);
					if (materialized.failedFactId !== undefined) {
						failures.push(...materialized.diagnostics);
						continue;
					}
					const { children, diagnostics } = materialized;
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
					const isBetter =
						best === undefined ||
						success.node.durationMs < best.node.durationMs - epsilon ||
						(Math.abs(success.node.durationMs - best.node.durationMs) <= epsilon &&
							(Order.String(selection.route.id, best.node.route?.id ?? "") < 0 ||
								(selection.route.id === best.node.route?.id &&
									Order.String(
										requirementSelection.key,
										bestRequirementSelectionKey,
									) < 0)));
					if (isBetter) {
						best = success;
						bestRequirementSelectionKey = requirementSelection.key;
					}
				}
			}
			if (best !== undefined) {
				rememberMaterialized(memoKey, best);
				return best;
			}
			return failures.length === 0
				? traceUnavailable(currentFactId, activeFactIds, diagnosticRouteId)
				: {
						diagnostics: uniqueDiagnostics(failures),
						status: "failure",
					};
		};

		let result: EstimateResult = traceUnavailable(factId, [], undefined);
		// Upgrade every reusable fact to the witness-wide maximum before sealing time and demand.
		for (let iteration = 0; iteration <= index.factCount; iteration += 1) {
			materializedMemo = new Map();
			result = solveFact(factId, quantity, []);
			if (result.status === "failure") break;
			const witnessRetainedQuantityByFact = readRetainedQuantityByFactFn(result.node);
			let upgraded = false;
			for (const [retainedFactId, retainedQuantity] of witnessRetainedQuantityByFact) {
				const currentQuantity = retainedQuantityByFact.get(retainedFactId) ?? 0;
				if (retainedQuantity <= currentQuantity + epsilon) continue;
				retainedQuantityByFact.set(retainedFactId, retainedQuantity);
				upgraded = true;
			}
			if (!upgraded) break;
			if (iteration === index.factCount) {
				result = {
					diagnostics: [
						{
							factId,
							kind: "retained-demand-not-stable",
							maximumIterations: index.factCount + 1,
						},
					],
					status: "failure",
				};
				break;
			}
		}
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
						kind === "any-of-selection-limit-exceeded" ||
						kind === "quantity-limit-exceeded" ||
						kind === "retained-demand-not-stable",
				)
					? "partial"
					: "unreachable",
			};
		}
		const projection = projectEstimateWitnessFn(result.node);
		return {
			diagnostics: uniqueDiagnostics(result.diagnostics).slice(0, maximumDiagnostics),
			durationMs: result.node.durationMs,
			factId,
			limitations: graph.limitations,
			obtainable: true,
			quantity,
			...projection,
			status: "complete",
		};
	});
};
