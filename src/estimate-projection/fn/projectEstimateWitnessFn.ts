import { Order } from "effect";

import type {
	EstimateAmount,
	EstimateProjection,
	EstimateRequirementStep,
	EstimateRouteStep,
} from "~/estimate-projection/type/EstimateProjection";
import type { EstimateWitnessNode } from "~/estimate-witness/type/EstimateWitnessNode";

interface EstimateNodeGraph {
	readonly nodes: ReadonlyArray<EstimateWitnessNode>;
	readonly occurrenceCountByNode: ReadonlyMap<EstimateWitnessNode, number>;
	readonly occurrenceIdByNode: ReadonlyMap<EstimateWitnessNode, string>;
}

const epsilon = 1e-9;

const createEstimateNodeGraph = (root: EstimateWitnessNode): EstimateNodeGraph => {
	const discovered = [
		root,
	];
	const discoveryIndex = new Map<EstimateWitnessNode, number>([
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
	const nodes: EstimateWitnessNode[] = [];
	const occurrenceCountByNode = new Map<EstimateWitnessNode, number>([
		[
			root,
			1,
		],
	]);
	const consumedOccurrenceCountByNode = new Map<EstimateWitnessNode, number>();
	const retainedNodes = new Set<EstimateWitnessNode>();
	while (ready.length > 0) {
		ready.sort((left, right) => discoveryIndex.get(left)! - discoveryIndex.get(right)!);
		const node = ready.shift()!;
		nodes.push(node);
		const occurrenceCount = occurrenceCountByNode.get(node) ?? 0;
		for (const { group, node: child } of node.children) {
			// Consumed plans repeat per parent occurrence; retained prerequisites are reusable.
			if (group.consumed > epsilon)
				consumedOccurrenceCountByNode.set(
					child,
					(consumedOccurrenceCountByNode.get(child) ?? 0) + occurrenceCount,
				);
			else retainedNodes.add(child);
			occurrenceCountByNode.set(
				child,
				(consumedOccurrenceCountByNode.get(child) ?? 0) +
					(retainedNodes.has(child) ? 1 : 0),
			);
			const remaining = (incomingCount.get(child) ?? 0) - 1;
			incomingCount.set(child, remaining);
			if (remaining === 0) ready.push(child);
		}
	}
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
}: EstimateNodeGraph): ReadonlyArray<EstimateRouteStep> =>
	nodes.map((node) => {
		const requirements: EstimateRequirementStep[] = [];
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
			oneTime.set(group.factId, Math.max(oneTime.get(group.factId) ?? 0, group.oneTime));
			ongoing.set(group.factId, Math.max(ongoing.get(group.factId) ?? 0, group.ongoing));
		}
	}
	const freeze = (quantities: ReadonlyMap<string, number>): ReadonlyArray<EstimateAmount> =>
		[
			...quantities,
		]
			.filter(([, amount]) => amount > epsilon)
			.sort(([left], [right]) => Order.String(left, right))
			.map(([factId, quantity]) => ({
				factId,
				quantity,
			}));
	return {
		consumed: freeze(consumed),
		oneTime: freeze(oneTime),
		ongoing: freeze(ongoing),
	};
};

/** Projects one stable witness into the route graph and aggregate requirement summary. */
export const projectEstimateWitnessFn = (root: EstimateWitnessNode): EstimateProjection => {
	const nodeGraph = createEstimateNodeGraph(root);
	const routeSteps = projectRouteSteps(nodeGraph);
	return {
		requirementSummary: readRequirementSummary(nodeGraph),
		route: routeSteps[0]!,
		routeSteps,
	};
};
