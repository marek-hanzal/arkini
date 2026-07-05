import type {
	BlueprintDependencyCycle,
	BlueprintDependencyEdge,
} from "~/config/validation/BlueprintDependencyTypes";

type BlueprintDependencyCycleWalkState = {
	cycles: BlueprintDependencyCycle[];
	edgeStack: BlueprintDependencyEdge[];
	edgesByBlueprintItemId: ReadonlyMap<string, readonly BlueprintDependencyEdge[]>;
	reportedCycleKeys: Set<string>;
	stack: string[];
	stackIndexByBlueprintItemId: Map<string, number>;
	visited: Set<string>;
	visiting: Set<string>;
};

const createBlueprintDependencyCycleWalkState = (
	edgesByBlueprintItemId: ReadonlyMap<string, readonly BlueprintDependencyEdge[]>,
): BlueprintDependencyCycleWalkState => ({
	cycles: [],
	edgeStack: [],
	edgesByBlueprintItemId,
	reportedCycleKeys: new Set(),
	stack: [],
	stackIndexByBlueprintItemId: new Map(),
	visited: new Set(),
	visiting: new Set(),
});

const enterBlueprintDependencyNode = (
	state: BlueprintDependencyCycleWalkState,
	blueprintItemId: string,
) => {
	state.visiting.add(blueprintItemId);
	state.stackIndexByBlueprintItemId.set(blueprintItemId, state.stack.length);
	state.stack.push(blueprintItemId);
};

const leaveBlueprintDependencyNode = (
	state: BlueprintDependencyCycleWalkState,
	blueprintItemId: string,
) => {
	state.stack.pop();
	state.stackIndexByBlueprintItemId.delete(blueprintItemId);
	state.visiting.delete(blueprintItemId);
	state.visited.add(blueprintItemId);
};

const readBlueprintDependencyCycleForEdge = ({
	edge,
	state,
}: {
	edge: BlueprintDependencyEdge;
	state: BlueprintDependencyCycleWalkState;
}): BlueprintDependencyCycle | undefined => {
	const cycleStartIndex = state.stackIndexByBlueprintItemId.get(edge.toBlueprintItemId);
	if (cycleStartIndex === undefined) return undefined;

	return {
		blueprintItemIds: [
			...state.stack.slice(cycleStartIndex),
			edge.toBlueprintItemId,
		],
		edges: [
			...state.edgeStack.slice(cycleStartIndex),
			edge,
		],
	};
};

const recordBlueprintDependencyCycle = (
	state: BlueprintDependencyCycleWalkState,
	cycle: BlueprintDependencyCycle,
) => {
	const cycleKey = readBlueprintDependencyCycleKey(cycle.blueprintItemIds);
	if (state.reportedCycleKeys.has(cycleKey)) return;

	state.reportedCycleKeys.add(cycleKey);
	state.cycles.push(cycle);
};

const visitBlueprintDependencyEdge = ({
	edge,
	state,
	visit,
}: {
	edge: BlueprintDependencyEdge;
	state: BlueprintDependencyCycleWalkState;
	visit: (blueprintItemId: string) => void;
}) => {
	const cycle = readBlueprintDependencyCycleForEdge({
		edge,
		state,
	});
	if (cycle) {
		recordBlueprintDependencyCycle(state, cycle);
		return;
	}

	if (state.visiting.has(edge.toBlueprintItemId)) return;
	state.edgeStack.push(edge);
	visit(edge.toBlueprintItemId);
	state.edgeStack.pop();
};

const visitBlueprintDependencyNode = (
	state: BlueprintDependencyCycleWalkState,
	blueprintItemId: string,
) => {
	if (state.visited.has(blueprintItemId)) return;

	enterBlueprintDependencyNode(state, blueprintItemId);
	for (const edge of state.edgesByBlueprintItemId.get(blueprintItemId) ?? []) {
		visitBlueprintDependencyEdge({
			edge,
			state,
			visit: (nextBlueprintItemId) =>
				visitBlueprintDependencyNode(state, nextBlueprintItemId),
		});
	}
	leaveBlueprintDependencyNode(state, blueprintItemId);
};

export const readBlueprintDependencyCycles = ({
	blueprintItemIds,
	edgesByBlueprintItemId,
}: {
	blueprintItemIds: ReadonlySet<string>;
	edgesByBlueprintItemId: ReadonlyMap<string, readonly BlueprintDependencyEdge[]>;
}) => {
	const state = createBlueprintDependencyCycleWalkState(edgesByBlueprintItemId);
	for (const blueprintItemId of [
		...blueprintItemIds,
	].sort()) {
		visitBlueprintDependencyNode(state, blueprintItemId);
	}
	return state.cycles;
};

const readBlueprintDependencyCycleKey = (cycleBlueprintItemIds: readonly string[]) => {
	const uniqueCycleItemIds = cycleBlueprintItemIds.slice(0, -1);
	if (uniqueCycleItemIds.length === 0) return cycleBlueprintItemIds.join("->");

	const rotations = uniqueCycleItemIds.map((_, index) =>
		[
			...uniqueCycleItemIds.slice(index),
			...uniqueCycleItemIds.slice(0, index),
		].join("->"),
	);

	return rotations.sort()[0] ?? cycleBlueprintItemIds.join("->");
};
