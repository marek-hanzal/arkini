import type {
	PlannerAcquisitionComponent,
	PlannerAcquisitionGraph,
	PlannerAcquisitionRequirements,
	PlannerAcquisitionRoute,
} from "~/editor/planner/PlannerAcquisitionGraph";
import { readPlannerAcquisitionRoutes } from "~/editor/planner/readPlannerAcquisitionRoutes";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

const compareIds = (left: string, right: string) => left.localeCompare(right);

const readStartQuantityByItemId = (config: GameConfigSchema.Type) => {
	const quantities = new Map<IdSchema.Type, number>();
	const add = (itemId: IdSchema.Type, quantity: number) =>
		quantities.set(itemId, (quantities.get(itemId) ?? 0) + quantity);

	for (const item of config.start.board) add(item.itemId, item.quantity ?? 1);
	for (const item of config.start.inventory) add(item.itemId, item.quantity);
	for (const item of config.start.toolbar) add(item.itemId, item.quantity ?? 1);
	return quantities;
};

const readRequirementItemIds = (requirements: PlannerAcquisitionRequirements) =>
	[
		...new Set([
			...requirements.allOf.map(({ itemId }) => itemId),
			...requirements.anyOf.flatMap((clause) => clause.map(({ itemId }) => itemId)),
		]),
	].sort(compareIds);

const indexRoutes = (
	routes: ReadonlyArray<PlannerAcquisitionRoute>,
	selectKeys: (route: PlannerAcquisitionRoute) => ReadonlyArray<IdSchema.Type>,
) => {
	const index = new Map<IdSchema.Type, PlannerAcquisitionRoute[]>();
	for (const route of routes) {
		for (const itemId of new Set(selectKeys(route))) {
			const candidates = index.get(itemId) ?? [];
			candidates.push(route);
			index.set(itemId, candidates);
		}
	}
	for (const candidates of index.values())
		candidates.sort((left, right) => compareIds(left.id, right.id));
	return index;
};

const readRouteRequirementDepth = (
	route: PlannerAcquisitionRoute,
	depthByItemId: ReadonlyMap<IdSchema.Type, number>,
) => {
	const depths: number[] = [];
	for (const requirement of route.requirements.allOf) {
		const depth = depthByItemId.get(requirement.itemId);
		if (depth === undefined) return undefined;
		depths.push(depth);
	}
	for (const clause of route.requirements.anyOf) {
		const alternativeDepths = clause.flatMap((requirement) => {
			const depth = depthByItemId.get(requirement.itemId);
			return depth === undefined
				? []
				: [
						depth,
					];
		});
		if (alternativeDepths.length === 0) return undefined;
		depths.push(Math.min(...alternativeDepths));
	}
	return Math.max(0, ...depths);
};

const resolveReachability = (
	routes: ReadonlyArray<PlannerAcquisitionRoute>,
	rootItemIds: ReadonlySet<IdSchema.Type>,
) => {
	const depthByItemId = new Map<IdSchema.Type, number>();
	for (const itemId of rootItemIds) depthByItemId.set(itemId, 0);
	const witnessRouteByItemId = new Map<IdSchema.Type, PlannerAcquisitionRoute>();

	let changed = true;
	while (changed) {
		changed = false;
		for (const route of routes) {
			const requirementDepth = readRouteRequirementDepth(route, depthByItemId);
			if (requirementDepth === undefined) continue;
			const routeDepth = requirementDepth + 1;
			const outputItemId = route.output.itemId;
			const currentDepth = depthByItemId.get(outputItemId);
			const currentWitness = witnessRouteByItemId.get(outputItemId);
			if (
				rootItemIds.has(outputItemId) ||
				(currentDepth !== undefined && currentDepth < routeDepth) ||
				(currentDepth === routeDepth &&
					currentWitness !== undefined &&
					compareIds(currentWitness.id, route.id) <= 0)
			)
				continue;
			depthByItemId.set(outputItemId, routeDepth);
			witnessRouteByItemId.set(outputItemId, route);
			changed = true;
		}
	}

	const routeDepthById = new Map<string, number>();
	for (const route of routes) {
		const requirementDepth = readRouteRequirementDepth(route, depthByItemId);
		if (requirementDepth !== undefined) routeDepthById.set(route.id, requirementDepth + 1);
	}
	return {
		depthByItemId,
		reachableRouteIds: new Set(routeDepthById.keys()),
		routeDepthById,
		witnessRouteByItemId,
	};
};

const readComponents = ({
	itemIds,
	reachableItemIds,
	rootItemIds,
	routes,
}: {
	readonly itemIds: ReadonlySet<IdSchema.Type>;
	readonly reachableItemIds: ReadonlySet<IdSchema.Type>;
	readonly rootItemIds: ReadonlySet<IdSchema.Type>;
	readonly routes: ReadonlyArray<PlannerAcquisitionRoute>;
}) => {
	const adjacency = new Map<IdSchema.Type, Set<IdSchema.Type>>(
		[
			...itemIds,
		].map((itemId) => [
			itemId,
			new Set<IdSchema.Type>(),
		]),
	);
	for (const route of routes) {
		const dependencies = adjacency.get(route.output.itemId) ?? new Set<IdSchema.Type>();
		for (const itemId of readRequirementItemIds(route.requirements)) dependencies.add(itemId);
		adjacency.set(route.output.itemId, dependencies);
	}

	let nextIndex = 0;
	const indexByItemId = new Map<IdSchema.Type, number>();
	const lowLinkByItemId = new Map<IdSchema.Type, number>();
	const stack: IdSchema.Type[] = [];
	const stackedItemIds = new Set<IdSchema.Type>();
	const componentItemIds: IdSchema.Type[][] = [];
	const visit = (itemId: IdSchema.Type) => {
		const index = nextIndex;
		nextIndex += 1;
		indexByItemId.set(itemId, index);
		lowLinkByItemId.set(itemId, index);
		stack.push(itemId);
		stackedItemIds.add(itemId);

		for (const dependencyItemId of [
			...(adjacency.get(itemId) ?? []),
		].sort(compareIds)) {
			if (!indexByItemId.has(dependencyItemId)) {
				visit(dependencyItemId);
				lowLinkByItemId.set(
					itemId,
					Math.min(
						lowLinkByItemId.get(itemId) ?? index,
						lowLinkByItemId.get(dependencyItemId) ?? index,
					),
				);
			} else if (stackedItemIds.has(dependencyItemId)) {
				lowLinkByItemId.set(
					itemId,
					Math.min(
						lowLinkByItemId.get(itemId) ?? index,
						indexByItemId.get(dependencyItemId) ?? index,
					),
				);
			}
		}

		if (lowLinkByItemId.get(itemId) !== indexByItemId.get(itemId)) return;
		const component: IdSchema.Type[] = [];
		while (stack.length > 0) {
			const candidate = stack.pop();
			if (candidate === undefined) break;
			stackedItemIds.delete(candidate);
			component.push(candidate);
			if (candidate === itemId) break;
		}
		component.sort(compareIds);
		componentItemIds.push(component);
	};

	for (const itemId of [
		...itemIds,
	].sort(compareIds))
		if (!indexByItemId.has(itemId)) visit(itemId);

	const components = componentItemIds
		.map((componentItems): PlannerAcquisitionComponent => {
			const cyclic =
				componentItems.length > 1 ||
				componentItems.some((itemId) => adjacency.get(itemId)?.has(itemId) === true);
			return {
				cyclic,
				id: `component:${componentItems[0] ?? "empty"}`,
				itemIds: componentItems,
				reachableItemIds: componentItems.filter((itemId) => reachableItemIds.has(itemId)),
				rootItemIds: componentItems.filter((itemId) => rootItemIds.has(itemId)),
				unreachableItemIds: componentItems.filter(
					(itemId) => !reachableItemIds.has(itemId),
				),
			};
		})
		.sort((left, right) => compareIds(left.id, right.id));
	const componentByItemId = new Map<IdSchema.Type, PlannerAcquisitionComponent>();
	for (const component of components)
		for (const itemId of component.itemIds) componentByItemId.set(itemId, component);
	return {
		componentByItemId,
		components,
	};
};

/**
 * Builds the planner's optimistic authored acquisition map.
 *
 * The graph answers only structural possibility. Runtime quantities, concrete identities,
 * ordering, exact charge arithmetic and lifecycle effects remain engine-backed search concerns.
 */
export const createPlannerAcquisitionGraph = (
	config: GameConfigSchema.Type,
): PlannerAcquisitionGraph => {
	const routes = readPlannerAcquisitionRoutes(config);
	const startQuantityByItemId = readStartQuantityByItemId(config);
	const rootItemIds = new Set(startQuantityByItemId.keys());
	const itemIds = new Set<IdSchema.Type>([
		...Object.keys(config.items),
		...rootItemIds,
		...routes.flatMap((route) => [
			route.output.itemId,
			...readRequirementItemIds(route.requirements),
		]),
	]);
	const { depthByItemId, reachableRouteIds, routeDepthById, witnessRouteByItemId } =
		resolveReachability(routes, rootItemIds);
	const reachableItemIds = new Set(depthByItemId.keys());
	const unreachableItemIds = new Set(
		[
			...itemIds,
		].filter((itemId) => !reachableItemIds.has(itemId)),
	);
	const routesByOutputItemId = indexRoutes(routes, (route) => [
		route.output.itemId,
	]);
	const routesByRequiredItemId = indexRoutes(routes, (route) =>
		readRequirementItemIds(route.requirements),
	);
	const { componentByItemId, components } = readComponents({
		itemIds,
		reachableItemIds,
		rootItemIds,
		routes,
	});

	return {
		componentByItemId,
		components,
		depthByItemId,
		itemIds,
		reachableItemIds,
		reachableRouteIds,
		rootItemIds,
		routeDepthById,
		routes,
		routesByOutputItemId,
		routesByRequiredItemId,
		startQuantityByItemId,
		unreachableItemIds,
		witnessRouteByItemId,
	};
};
