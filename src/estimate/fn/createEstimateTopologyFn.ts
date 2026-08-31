import { Graph, Order } from "effect";

import type {
	AcquisitionGraph,
	AcquisitionRequirement,
	AcquisitionRoute,
} from "~/flow/type/AcquisitionGraph";

interface EstimateRouteRequirements {
	readonly allOf: ReadonlyArray<AcquisitionRequirement>;
	readonly anyOf: ReadonlyArray<ReadonlyArray<AcquisitionRequirement>>;
}

export interface EstimateTopology {
	readonly componentByFact: ReadonlyMap<string, string>;
	readonly factCount: number;
	readonly factIds: ReadonlySet<string>;
	readonly requirementsByRoute: ReadonlyMap<AcquisitionRoute, EstimateRouteRequirements>;
	readonly roots: ReadonlyMap<string, number | "unbounded">;
	readonly routesByFact: ReadonlyMap<string, ReadonlyArray<AcquisitionRoute>>;
	readonly seededComponentByFact: ReadonlyMap<string, string>;
	readonly unsupportedRoutes: ReadonlySet<AcquisitionRoute>;
}

const projectRequirementFn = (requirement: AcquisitionRequirement): AcquisitionRequirement =>
	requirement.source === "charged-item"
		? {
				...requirement,
				quantity: 1,
				usage: "one-time",
			}
		: requirement;

const projectRequirementsFn = (route: AcquisitionRoute): EstimateRouteRequirements => ({
	// Positive enable facts remain hard acquisition prerequisites. Negative/alternative
	// condition branches cannot add optimistic authored demand.
	allOf: route.requirements.allOf.map(projectRequirementFn),
	anyOf: route.requirements.anyOf
		.map((clause) =>
			clause.filter(
				({ source }) => source !== "line-condition" && source !== "output-condition",
			),
		)
		.map((clause) => clause.map(projectRequirementFn))
		.filter((clause) => clause.length > 0),
});

const readComponentsFn = ({
	dependencyEdges,
	factIds,
	rootFactIds,
}: {
	readonly dependencyEdges: ReadonlyArray<
		readonly [
			fromFactId: string,
			toFactId: string,
		]
	>;
	readonly factIds: ReadonlyArray<string>;
	readonly rootFactIds: ReadonlySet<string>;
}) => {
	const nodeByFact = new Map<string, Graph.NodeIndex>();
	const factByNode = new Map<Graph.NodeIndex, string>();
	const graph = Graph.directed<string, void>((mutable) => {
		for (const factId of [
			...new Set(factIds),
		].sort(Order.String)) {
			const node = Graph.addNode(mutable, factId);
			nodeByFact.set(factId, node);
			factByNode.set(node, factId);
		}
		for (const [fromFactId, toFactId] of dependencyEdges) {
			const from = nodeByFact.get(fromFactId);
			const to = nodeByFact.get(toFactId);
			if (from !== undefined && to !== undefined) Graph.addEdge(mutable, from, to, undefined);
		}
	});
	const components = Graph.stronglyConnectedComponents(graph)
		.map((nodes) =>
			nodes
				.map((node) => factByNode.get(node))
				.filter((factId): factId is string => factId !== undefined)
				.sort(Order.String),
		)
		.sort(([left = ""], [right = ""]) => Order.String(left, right));
	const componentByFact = new Map<string, string>();
	const seededComponentByFact = new Map<string, string>();
	for (const component of components) {
		const componentId = component[0];
		if (componentId === undefined) continue;
		const seeded = component.some((factId) => rootFactIds.has(factId));
		for (const factId of component) {
			componentByFact.set(factId, componentId);
			if (seeded) seededComponentByFact.set(factId, componentId);
		}
	}
	return {
		componentByFact,
		seededComponentByFact,
	};
};

/** Indexes immutable acquisition topology and authored seed evidence for one Estimate batch. */
export const createEstimateTopologyFn = (graph: AcquisitionGraph): EstimateTopology => {
	const factIds = new Set(graph.factIds);
	const roots = new Map(
		graph.roots.map(({ factId, quantity }) => [
			factId,
			quantity,
		]),
	);
	const requirementsByRoute = new Map(
		graph.routes.map(
			(route) =>
				[
					route,
					projectRequirementsFn(route),
				] as const,
		),
	);
	const unsupportedRoutes = new Set(
		graph.routes.filter(
			(route) => route.operation?.outputCompilation === "state-space-unsupported",
		),
	);
	const routesByFact = new Map<string, AcquisitionRoute[]>();
	for (const route of graph.routes) {
		const routes = routesByFact.get(route.output.factId) ?? [];
		routes.push(route);
		routesByFact.set(route.output.factId, routes);
	}
	for (const routes of routesByFact.values())
		routes.sort((left, right) => Order.String(left.id, right.id));
	const { componentByFact, seededComponentByFact } = readComponentsFn({
		dependencyEdges: graph.routes
			.filter((route) => !unsupportedRoutes.has(route))
			.flatMap((route) =>
				[
					...(requirementsByRoute.get(route)?.allOf ?? []),
					...(requirementsByRoute.get(route)?.anyOf ?? []).flat(),
				].map(
					({ factId }) =>
						[
							route.output.factId,
							factId,
						] as const,
				),
			),
		factIds: graph.factIds,
		rootFactIds: new Set(roots.keys()),
	});
	return {
		componentByFact,
		factCount: factIds.size,
		factIds,
		requirementsByRoute,
		roots,
		routesByFact,
		seededComponentByFact,
		unsupportedRoutes,
	};
};
