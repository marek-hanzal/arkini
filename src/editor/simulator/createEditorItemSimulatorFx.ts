import { Effect } from "effect";

import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { LineSchema } from "~/engine/line/schema/LineSchema";
import type { MergeSchema } from "~/engine/merge/schema/MergeSchema";
import type { DropSchema } from "~/engine/output/schema/DropSchema";
import type { OutputSchema } from "~/engine/output/schema/OutputSchema";
import type { QuantitySchema } from "~/engine/quantity/schema/QuantitySchema";
import type { QuerySchema } from "~/engine/query/schema/QuerySchema";
import type { RollSchema } from "~/engine/roll/schema/RollSchema";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { WhenSchema } from "~/engine/when/schema/WhenSchema";

import type {
	EditorItemSimulation,
	EditorItemSimulationOperation,
	EditorItemSimulationScenario,
	EditorItemSimulationScenarioResult,
} from "~/editor/simulator/EditorItemSimulation";

type EditorSimulationLocation = "board" | "board-related" | "inventory" | "job" | "toolbar";

interface EditorSimulationChargeInstance {
	location: EditorSimulationLocation;
	remaining: number;
}

interface EditorSimulationState {
	readonly stock: Map<string, number>;
	readonly locations: Map<string, Map<EditorSimulationLocation, number>>;
	readonly charges: Map<string, EditorSimulationChargeInstance[]>;
	readonly consumed: Map<string, number>;
	readonly infrastructureItemIds: Set<string>;
	readonly operations: Map<string, EditorItemSimulationOperation>;
	readonly warnings: Set<string>;
	runtimeMs: number;
}

const cloneLocations = (
	locations: EditorSimulationState["locations"],
): EditorSimulationState["locations"] =>
	new Map(
		[
			...locations,
		].map(([itemId, quantities]) => [
			itemId,
			new Map(quantities),
		]),
	);

/** Creates an isolated branch for deterministic optimistic path exploration. */
const cloneEditorSimulationState = (state: EditorSimulationState): EditorSimulationState => ({
	stock: new Map(state.stock),
	locations: cloneLocations(state.locations),
	charges: new Map(
		[
			...state.charges,
		].map(([itemId, instances]) => [
			itemId,
			instances.map((instance) => ({
				...instance,
			})),
		]),
	),
	consumed: new Map(state.consumed),
	infrastructureItemIds: new Set(state.infrastructureItemIds),
	operations: new Map(state.operations),
	warnings: new Set(state.warnings),
	runtimeMs: state.runtimeMs,
});

const readLocationQuantity = (
	state: EditorSimulationState,
	itemId: string,
	location: EditorSimulationLocation,
) => state.locations.get(itemId)?.get(location) ?? 0;

const writeLocationQuantity = (
	state: EditorSimulationState,
	itemId: string,
	location: EditorSimulationLocation,
	quantity: number,
) => {
	const locations = state.locations.get(itemId) ?? new Map();
	if (quantity > 1e-9) locations.set(location, quantity);
	else locations.delete(location);
	if (locations.size > 0) state.locations.set(itemId, locations);
	else state.locations.delete(itemId);
};

const addConsumed = (state: EditorSimulationState, itemId: string, quantity: number) =>
	state.consumed.set(itemId, (state.consumed.get(itemId) ?? 0) + quantity);

const canItemUseLocation = (
	config: GameConfigSchema.Type,
	itemId: string,
	location: EditorSimulationLocation,
) => {
	if (location === "job") return true;
	const item = config.items[itemId];
	if (item === undefined) return false;
	if (location === "board" || location === "board-related")
		return item.scope === "board" || item.scope === "any";
	if (location === "inventory") return item.scope === "inventory" || item.scope === "any";
	return (
		item.scope === "toolbar" ||
		item.scope === "any" ||
		(item.type === "inventory" && item.scope === "board")
	);
};

/** Adds one resolved output without attempting physical board placement. */
const addEditorSimulationItem = (
	config: GameConfigSchema.Type,
	state: EditorSimulationState,
	itemId: string,
	quantity: number,
	location: EditorSimulationLocation,
): boolean => {
	if (quantity <= 0) return true;
	const item = config.items[itemId];
	if (item === undefined) return false;
	const previous = state.stock.get(itemId) ?? 0;
	if (item.maxCount !== undefined && previous + quantity > item.maxCount + 1e-9) return false;
	if (!canItemUseLocation(config, itemId, location)) return false;
	state.stock.set(itemId, previous + quantity);
	const previousLocationQuantity = readLocationQuantity(state, itemId, location);
	writeLocationQuantity(state, itemId, location, previousLocationQuantity + quantity);
	if (item.charges !== undefined) {
		const instances = state.charges.get(itemId) ?? [];
		const existingAtLocation = instances.filter(
			(instance) => instance.location === location,
		).length;
		const requiredAtLocation = Math.floor(previousLocationQuantity + quantity + 1e-9);
		for (let index = existingAtLocation; index < requiredAtLocation; index += 1)
			instances.push({
				location,
				remaining: item.charges.amount,
			});
		state.charges.set(itemId, instances);
	}
	return true;
};

/** Removes fungible material, optionally reporting it as a total simulation cost. */
const removeEditorSimulationItem = (
	state: EditorSimulationState,
	itemId: string,
	quantity: number,
	consume: boolean,
): boolean => {
	const available = state.stock.get(itemId) ?? 0;
	if (available + 1e-9 < quantity) return false;
	let remaining = quantity;
	const locations = state.locations.get(itemId);
	if (locations === undefined) return false;
	for (const [location, locationQuantity] of [
		...locations,
	]) {
		const removed = Math.min(locationQuantity, remaining);
		writeLocationQuantity(state, itemId, location, locationQuantity - removed);
		remaining -= removed;
		if (remaining <= 1e-9) break;
	}
	state.stock.set(itemId, Math.max(0, available - quantity));
	if ((state.stock.get(itemId) ?? 0) <= 1e-9) state.stock.delete(itemId);
	const chargeInstances = state.charges.get(itemId);
	if (chargeInstances !== undefined) {
		chargeInstances.splice(0, Math.min(chargeInstances.length, Math.ceil(quantity)));
		if (chargeInstances.length === 0) state.charges.delete(itemId);
	}
	if (consume) addConsumed(state, itemId, quantity);
	return true;
};

/** Moves already-owned quantity into the optimistic scope needed by a gameplay query. */
const moveEditorSimulationItem = (
	config: GameConfigSchema.Type,
	state: EditorSimulationState,
	itemId: string,
	quantity: number,
	target: EditorSimulationLocation,
): boolean => {
	if ((state.stock.get(itemId) ?? 0) + 1e-9 < quantity) return false;
	const atTarget = readLocationQuantity(state, itemId, target);
	let remaining = Math.max(0, quantity - atTarget);
	if (remaining <= 1e-9) return true;
	if (!canItemUseLocation(config, itemId, target)) return false;
	const locations = state.locations.get(itemId);
	if (locations === undefined) return false;
	for (const [location, locationQuantity] of [
		...locations,
	]) {
		if (location === target) continue;
		const moved = Math.min(locationQuantity, remaining);
		writeLocationQuantity(state, itemId, location, locationQuantity - moved);
		writeLocationQuantity(
			state,
			itemId,
			target,
			readLocationQuantity(state, itemId, target) + moved,
		);
		const instances = state.charges.get(itemId) ?? [];
		let instancesToMove = Math.floor(moved + 1e-9);
		for (const instance of instances) {
			if (instancesToMove === 0) break;
			if (instance.location !== location) continue;
			instance.location = target;
			instancesToMove -= 1;
		}
		remaining -= moved;
		if (remaining <= 1e-9) return true;
	}
	return false;
};

/** Relocates an exact quantity out of one query-visible scope. */
const relocateEditorSimulationItem = (
	config: GameConfigSchema.Type,
	state: EditorSimulationState,
	itemId: string,
	quantity: number,
	from: EditorSimulationLocation,
	target: EditorSimulationLocation,
): boolean => {
	const available = readLocationQuantity(state, itemId, from);
	if (available + 1e-9 < quantity) return false;
	if (!canItemUseLocation(config, itemId, target)) return false;
	writeLocationQuantity(state, itemId, from, available - quantity);
	writeLocationQuantity(
		state,
		itemId,
		target,
		readLocationQuantity(state, itemId, target) + quantity,
	);
	let instancesToMove = Math.floor(quantity + 1e-9);
	for (const instance of state.charges.get(itemId) ?? []) {
		if (instancesToMove === 0) break;
		if (instance.location !== from) continue;
		instance.location = target;
		instancesToMove -= 1;
	}
	return true;
};

const readEditorSimulationQueryQuantity = (
	state: EditorSimulationState,
	query: QuerySchema.Type,
	ownerItemId: string,
) => {
	const itemId = query.selector.itemId;
	const locations = state.locations.get(itemId);
	if (locations === undefined) return 0;
	switch (query.scope) {
		case "board":
			if (query.distance === "self")
				return itemId === ownerItemId ? Math.min(1, locations.get("board") ?? 0) : 0;
			return Math.max(0, (locations.get("board") ?? 0) - (itemId === ownerItemId ? 1 : 0));
		case "inventory":
			return locations.get("inventory") ?? 0;
		case "toolbar":
			return locations.get("toolbar") ?? 0;
		case "any":
			return (
				(locations.get("board") ?? 0) +
				(locations.get("board-related") ?? 0) +
				(locations.get("inventory") ?? 0) +
				(locations.get("toolbar") ?? 0)
			);
		case "universe":
			return [
				...locations,
			].reduce(
				(total, [location, quantity]) => (location === "job" ? total : total + quantity),
				0,
			);
	}
};

const readEditorSimulationQueryLocation = (query: QuerySchema.Type): EditorSimulationLocation => {
	switch (query.scope) {
		case "board":
		case "any":
		case "universe":
			return "board";
		case "inventory":
			return "inventory";
		case "toolbar":
			return "toolbar";
	}
};

/** Pays one exact charged instance and removes it when gameplay depletion reaches zero. */
const spendEditorSimulationCharge = (
	state: EditorSimulationState,
	itemId: string,
	cost: number,
	location: EditorSimulationLocation,
):
	| {
			readonly depleted: boolean;
	  }
	| undefined => {
	const instances = state.charges.get(itemId);
	const instance = instances?.find(
		(candidate) => candidate.location === location && candidate.remaining >= cost,
	);
	if (instance === undefined) return undefined;
	instance.remaining -= cost;
	if (instance.remaining > 0)
		return {
			depleted: false,
		};
	const index = instances?.indexOf(instance) ?? -1;
	if (index >= 0) instances?.splice(index, 1);
	if (instances?.length === 0) state.charges.delete(itemId);
	const stock = state.stock.get(itemId) ?? 0;
	state.stock.set(itemId, Math.max(0, stock - 1));
	if ((state.stock.get(itemId) ?? 0) <= 1e-9) state.stock.delete(itemId);
	writeLocationQuantity(
		state,
		itemId,
		location,
		readLocationQuantity(state, itemId, location) - 1,
	);
	addConsumed(state, itemId, 1);
	return {
		depleted: true,
	};
};

const readStorageCandidates = (item: ItemSchema.Type): ReadonlyArray<EditorSimulationLocation> =>
	item.scope === "board"
		? [
				"board",
			]
		: item.scope === "inventory"
			? [
					"inventory",
				]
			: item.scope === "toolbar"
				? [
						"toolbar",
					]
				: [
						"board",
						"inventory",
						"toolbar",
					];

/** Returns reserved material to the first authored storage scope without physical placement. */
const returnReservedEditorSimulationItem = (
	config: GameConfigSchema.Type,
	state: EditorSimulationState,
	itemId: string,
	quantity: number,
	from: EditorSimulationLocation,
) => {
	const item = config.items[itemId];
	if (item === undefined) return false;
	const candidates = readStorageCandidates(item);
	return candidates.some((target) =>
		relocateEditorSimulationItem(config, state, itemId, quantity, from, target),
	);
};

/** Records one output in the first authored storage scope without physical placement. */
const addEditorSimulationOutput = (
	config: GameConfigSchema.Type,
	state: EditorSimulationState,
	itemId: string,
	quantity: number,
) => {
	const item = config.items[itemId];
	if (item === undefined) return false;
	const candidates = readStorageCandidates(item);
	return candidates.some((location) =>
		addEditorSimulationItem(config, state, itemId, quantity, location),
	);
};

const hasEditorSimulationCharge = (
	state: EditorSimulationState,
	itemId: string,
	cost: number,
	location: EditorSimulationLocation,
) =>
	state.charges
		.get(itemId)
		?.some((instance) => instance.location === location && instance.remaining >= cost) ?? false;

/** Hydrates the editor simulator from the same authored new-game inventory. */
const makeEditorSimulationState = (config: GameConfigSchema.Type): EditorSimulationState => {
	const state: EditorSimulationState = {
		stock: new Map(),
		locations: new Map(),
		charges: new Map(),
		consumed: new Map(),
		infrastructureItemIds: new Set(),
		operations: new Map(),
		warnings: new Set([
			"All gameplay operations are simulated sequentially; no parallel production is assumed.",
			"Board coordinates, capacity, spaces, and physical placement are not simulated.",
			"Spatial rules are satisfied optimistically when their required items can exist on the board.",
			"When alternatives exist, the simulator uses a deterministic optimistic local runtime heuristic rather than exhaustive global optimization.",
		]),
		runtimeMs: 0,
	};
	for (const item of config.start.board.filter(
		(candidate) => candidate.space === config.start.currentSpace,
	))
		addEditorSimulationItem(config, state, item.itemId, item.quantity ?? 1, "board");
	for (const item of config.start.inventory)
		addEditorSimulationItem(config, state, item.itemId, item.quantity, "inventory");
	for (const item of config.start.toolbar)
		addEditorSimulationItem(config, state, item.itemId, item.quantity ?? 1, "toolbar");
	return state;
};

interface EditorSimulationOperation {
	readonly id: string;
	readonly ownerItemId: string;
	readonly line: LineSchema.Type;
	readonly output: OutputSchema.Type;
}

const readItemLines = (item: ItemSchema.Type): ReadonlyArray<LineSchema.Type> => {
	switch (item.type) {
		case "blueprint":
		case "craft":
		case "stash":
			return [
				item.line,
			];
		case "deposit":
		case "producer":
			return item.lines ?? [];
		case "inventory":
		case "simple":
		case "temporary":
			return [];
	}
};

/** Indexes every authored production line that can emit an item. */
const readEditorSimulationOperations = (
	config: GameConfigSchema.Type,
): ReadonlyArray<EditorSimulationOperation> =>
	Object.values(config.items).flatMap((item) =>
		readItemLines(item).flatMap((line) =>
			line.output === undefined
				? []
				: [
						{
							id: `source:${item.id}:line:${line.id}`,
							ownerItemId: item.id,
							line,
							output: line.output,
						},
					],
		),
	);

interface EditorSimulationOutput {
	readonly itemId: string;
	readonly quantity: number;
}

const quantityForScenario = (
	quantity: QuantitySchema.Type,
	scenario: EditorItemSimulationScenario,
) => {
	switch (scenario) {
		case "best":
			return quantity.max;
		case "expected":
			return (quantity.min + quantity.max) / 2;
		case "guaranteed":
			return quantity.min;
	}
};

const dropEnabled = (drop: DropSchema.Type, evaluateWhen: (when: WhenSchema.Type) => boolean) =>
	drop.rules.every((rule) => {
		const active = rule.when.every(evaluateWhen);
		return rule.type === "enable" ? active : !active;
	});

const addYield = (target: Map<string, number>, itemId: string, quantity: number) =>
	target.set(itemId, (target.get(itemId) ?? 0) + quantity);

const addDropYield = (
	target: Map<string, number>,
	drop: DropSchema.Type,
	multiplier: number,
	scenario: EditorItemSimulationScenario,
	evaluateWhen: (when: WhenSchema.Type) => boolean,
) => {
	if (!dropEnabled(drop, evaluateWhen)) return;
	addYield(target, drop.itemId, quantityForScenario(drop.quantity, scenario) * multiplier);
};

const rollYield = (
	roll: RollSchema.Type,
	scenario: EditorItemSimulationScenario,
	targetItemId: string,
	evaluateWhen: (when: WhenSchema.Type) => boolean,
): Map<string, number> => {
	const result = new Map<string, number>();
	switch (roll.type) {
		case "guaranteed":
			for (const drop of roll.drop) addDropYield(result, drop, 1, scenario, evaluateWhen);
			return result;
		case "chance": {
			const multiplier =
				scenario === "best"
					? 1
					: scenario === "expected"
						? roll.chance
						: roll.chance === 1
							? 1
							: 0;
			for (const drop of roll.drop)
				addDropYield(result, drop, multiplier, scenario, evaluateWhen);
			return result;
		}
		case "weight": {
			const picks = quantityForScenario(roll.quantity, scenario);
			if (scenario === "expected") {
				const totalWeight = roll.drop.reduce(
					(total, candidate) => total + candidate.weight,
					0,
				);
				for (const candidate of roll.drop)
					for (const drop of candidate.drop)
						addDropYield(
							result,
							drop,
							picks * (candidate.weight / totalWeight),
							scenario,
							evaluateWhen,
						);
				return result;
			}
			const candidates = roll.drop.map((candidate) => {
				const candidateYield = new Map<string, number>();
				for (const drop of candidate.drop)
					addDropYield(candidateYield, drop, picks, scenario, evaluateWhen);
				return candidateYield;
			});
			const compare = (left: Map<string, number>, right: Map<string, number>) =>
				(left.get(targetItemId) ?? 0) - (right.get(targetItemId) ?? 0);
			candidates.sort(compare);
			return candidates[scenario === "best" ? candidates.length - 1 : 0] ?? result;
		}
	}
};

/** Resolves one scenario projection while applying the same conditional drop semantics as gameplay. */
const resolveEditorSimulationOutput = ({
	evaluateWhen,
	output,
	scenario,
	targetItemId,
}: {
	readonly evaluateWhen: (when: WhenSchema.Type) => boolean;
	readonly output: OutputSchema.Type;
	readonly scenario: EditorItemSimulationScenario;
	readonly targetItemId: string;
}): ReadonlyArray<EditorSimulationOutput> => {
	const sets = output.set.map((set) => {
		const result = new Map<string, number>();
		for (const roll of set.roll)
			for (const [itemId, quantity] of rollYield(roll, scenario, targetItemId, evaluateWhen))
				addYield(result, itemId, quantity);
		return {
			result,
			weight: set.weight,
		};
	});
	let selected: Map<string, number>;
	if (scenario === "expected") {
		selected = new Map();
		const totalWeight = sets.reduce((total, set) => total + set.weight, 0);
		for (const set of sets)
			for (const [itemId, quantity] of set.result)
				addYield(selected, itemId, quantity * (set.weight / totalWeight));
	} else {
		sets.sort(
			(left, right) =>
				(left.result.get(targetItemId) ?? 0) - (right.result.get(targetItemId) ?? 0),
		);
		selected = sets[scenario === "best" ? sets.length - 1 : 0]?.result ?? new Map();
	}
	return [
		...selected,
	].map(([itemId, quantity]) => ({
		itemId,
		quantity,
	}));
};

const maximumRunsPerRequirement = 100_000;

type RequireItem = (
	state: EditorSimulationState,
	itemId: string,
	quantity: number,
	consume: boolean,
	path: ReadonlySet<string>,
) => EditorSimulationState | undefined;

const evaluateWhen = (state: EditorSimulationState, when: WhenSchema.Type, ownerItemId: string) => {
	const quantity = readEditorSimulationQueryQuantity(state, when.query, ownerItemId);
	switch (when.type) {
		case "exists":
			return quantity > 0;
		case "count":
			return Math.abs(quantity - when.count) <= 1e-9;
		case "range":
			return quantity >= when.min && quantity <= when.max;
	}
};

const readWhenMinimum = (when: WhenSchema.Type) => {
	switch (when.type) {
		case "exists":
			return 1;
		case "count":
			return when.count;
		case "range":
			return when.min;
	}
};

const readWhenMaximum = (when: WhenSchema.Type) => {
	switch (when.type) {
		case "exists":
			return Number.POSITIVE_INFINITY;
		case "count":
			return when.count;
		case "range":
			return when.max;
	}
};

const moveExcessOutOfQuery = (
	config: GameConfigSchema.Type,
	state: EditorSimulationState,
	query: QuerySchema.Type,
	quantity: number,
) => {
	if (quantity <= 1e-9) return true;
	const item = config.items[query.selector.itemId];
	if (item === undefined || query.scope === "universe") return false;
	if (query.scope === "board" && query.distance === "self") return false;
	let from: EditorSimulationLocation;
	let target: EditorSimulationLocation;
	switch (query.scope) {
		case "board":
			from = "board";
			target =
				query.distance === "far" && item.scope === "any" ? "inventory" : "board-related";
			break;
		case "inventory":
			if (item.scope !== "any") return false;
			from = "inventory";
			target = "board";
			break;
		case "toolbar":
			if (item.scope !== "any") return false;
			from = "toolbar";
			target = "board";
			break;
		case "any":
			from = readEditorSimulationQueryLocation(query);
			target = "board-related";
			break;
	}
	return relocateEditorSimulationItem(
		config,
		state,
		query.selector.itemId,
		quantity,
		from,
		target,
	);
};

const ensureWhen = (
	config: GameConfigSchema.Type,
	state: EditorSimulationState,
	when: WhenSchema.Type,
	ownerItemId: string,
	path: ReadonlySet<string>,
	requireItem: RequireItem,
): EditorSimulationState | undefined => {
	const itemId = when.query.selector.itemId;
	if (when.query.scope === "board" && when.query.distance === "self" && itemId !== ownerItemId)
		return undefined;
	const minimum = readWhenMinimum(when);
	const maximum = readWhenMaximum(when);
	let current = readEditorSimulationQueryQuantity(state, when.query, ownerItemId);
	let planned = state;
	if (current < minimum) {
		const ownerOffset =
			when.query.scope === "board" && when.query.distance !== "self" && itemId === ownerItemId
				? 1
				: 0;
		const requiredQuantity = minimum + ownerOffset;
		const acquired = requireItem(planned, itemId, requiredQuantity, false, path);
		if (acquired === undefined) return undefined;
		planned = acquired;
		const target = readEditorSimulationQueryLocation(when.query);
		if (!moveEditorSimulationItem(config, planned, itemId, requiredQuantity, target))
			return undefined;
		planned.infrastructureItemIds.add(itemId);
		current = readEditorSimulationQueryQuantity(planned, when.query, ownerItemId);
	}
	if (current > maximum) {
		if (!moveExcessOutOfQuery(config, planned, when.query, current - maximum)) return undefined;
	}
	if (minimum > 0) planned.infrastructureItemIds.add(itemId);
	return evaluateWhen(planned, when, ownerItemId) ? planned : undefined;
};

const falsifyWhen = (
	config: GameConfigSchema.Type,
	state: EditorSimulationState,
	when: WhenSchema.Type,
	ownerItemId: string,
) => {
	if (!evaluateWhen(state, when, ownerItemId)) return true;
	const quantity = readEditorSimulationQueryQuantity(state, when.query, ownerItemId);
	if (when.type === "exists") return moveExcessOutOfQuery(config, state, when.query, quantity);
	if (when.type === "range" && when.min > 0)
		return moveExcessOutOfQuery(config, state, when.query, quantity - when.min + 1);
	if (when.type === "count" && when.count > 0)
		return moveExcessOutOfQuery(config, state, when.query, 1);
	return false;
};

const prepareLineRules = (
	config: GameConfigSchema.Type,
	state: EditorSimulationState,
	line: LineSchema.Type,
	ownerItemId: string,
	path: ReadonlySet<string>,
	requireItem: RequireItem,
): EditorSimulationState | undefined => {
	const enableRules = line.rules.filter((rule) => rule.type === "enable");
	if (enableRules.length === 0 && !line.enable) return undefined;
	let planned = state;
	for (const rule of enableRules)
		for (const when of rule.when) {
			const enabled = ensureWhen(config, planned, when, ownerItemId, path, requireItem);
			if (enabled === undefined) return undefined;
			planned = enabled;
		}
	for (const rule of line.rules.filter((candidate) => candidate.type === "disable")) {
		if (!rule.when.every((when) => evaluateWhen(planned, when, ownerItemId))) continue;
		let falsified = false;
		for (const when of rule.when) {
			const candidate = cloneEditorSimulationState(planned);
			if (falsifyWhen(config, candidate, when, ownerItemId)) {
				planned = candidate;
				falsified = true;
				break;
			}
		}
		if (!falsified) return undefined;
	}
	return planned;
};

const prepareTargetDropRules = (
	config: GameConfigSchema.Type,
	state: EditorSimulationState,
	operation: EditorSimulationOperation,
	targetItemId: string,
	path: ReadonlySet<string>,
	requireItem: RequireItem,
): EditorSimulationState | undefined => {
	const drops = operation.output.set.flatMap((set) =>
		set.roll.flatMap((roll) =>
			roll.type === "weight" ? roll.drop.flatMap((candidate) => candidate.drop) : roll.drop,
		),
	);
	const targetDrops = drops.filter((drop) => drop.itemId === targetItemId);
	if (targetDrops.length === 0) return state;
	for (const drop of targetDrops) {
		let planned = cloneEditorSimulationState(state);
		let valid = true;
		for (const rule of drop.rules) {
			if (rule.type === "enable") {
				for (const when of rule.when) {
					const enabled = ensureWhen(
						config,
						planned,
						when,
						operation.ownerItemId,
						path,
						requireItem,
					);
					if (enabled === undefined) {
						valid = false;
						break;
					}
					planned = enabled;
				}
			} else if (
				rule.when.every((when) => evaluateWhen(planned, when, operation.ownerItemId))
			) {
				valid = rule.when.some((when) =>
					falsifyWhen(config, planned, when, operation.ownerItemId),
				);
			}
			if (!valid) break;
		}
		if (valid) return planned;
	}
	return undefined;
};

const resolveLineRuntime = (
	state: EditorSimulationState,
	line: LineSchema.Type,
	ownerItemId: string,
) => {
	let multiplier = 1;
	let adjustmentMs = 0;
	for (const rule of line.rules) {
		if (!rule.when.every((when) => evaluateWhen(state, when, ownerItemId))) continue;
		if (rule.type === "runtime:multiplier") multiplier *= rule.multiplier;
		if (rule.type === "runtime:adjust") adjustmentMs += rule.adjustMs;
	}
	return Math.max(0, Math.ceil(line.runtimeMs * multiplier + adjustmentMs));
};

const lineEnabled = (state: EditorSimulationState, line: LineSchema.Type, ownerItemId: string) => {
	const enableRules = line.rules.filter((rule) => rule.type === "enable");
	const enabled =
		enableRules.length > 0
			? enableRules.every((rule) =>
					rule.when.every((when) => evaluateWhen(state, when, ownerItemId)),
				)
			: line.enable;
	const disabled = line.rules.some(
		(rule) =>
			rule.type === "disable" &&
			rule.when.every((when) => evaluateWhen(state, when, ownerItemId)),
	);
	return enabled && !disabled;
};

const applyOutput = (
	config: GameConfigSchema.Type,
	state: EditorSimulationState,
	output: LineSchema.Type["output"],
	scenario: EditorItemSimulationScenario,
	targetItemId: string,
	ownerItemId: string,
) => {
	if (output === undefined) return true;
	const resolved = resolveEditorSimulationOutput({
		evaluateWhen: (when) => evaluateWhen(state, when, ownerItemId),
		output,
		scenario,
		targetItemId,
	});
	for (const drop of resolved)
		if (!addEditorSimulationOutput(config, state, drop.itemId, drop.quantity)) return false;
	return true;
};

interface ChargePayment {
	readonly itemId: string;
	readonly cost: number;
	readonly location: EditorSimulationLocation;
	readonly owner: boolean;
}

const ensureChargePayment = (
	config: GameConfigSchema.Type,
	state: EditorSimulationState,
	payment: ChargePayment,
	path: ReadonlySet<string>,
	requireItem: RequireItem,
): EditorSimulationState | undefined => {
	if (hasEditorSimulationCharge(state, payment.itemId, payment.cost, payment.location))
		return state;
	const requiredQuantity = Math.floor(state.stock.get(payment.itemId) ?? 0) + 1;
	const planned = requireItem(state, payment.itemId, requiredQuantity, false, path);
	if (planned === undefined) return undefined;
	if (!moveEditorSimulationItem(config, planned, payment.itemId, 1, payment.location))
		return undefined;
	return hasEditorSimulationCharge(planned, payment.itemId, payment.cost, payment.location)
		? planned
		: undefined;
};

const runOperation = (
	config: GameConfigSchema.Type,
	state: EditorSimulationState,
	operation: EditorSimulationOperation,
	scenario: EditorItemSimulationScenario,
	targetItemId: string,
	path: ReadonlySet<string>,
	requireItem: RequireItem,
): EditorSimulationState | undefined => {
	let planned = requireItem(state, operation.ownerItemId, 1, false, path);
	if (planned === undefined) return undefined;
	if (!moveEditorSimulationItem(config, planned, operation.ownerItemId, 1, "board"))
		return undefined;
	planned.infrastructureItemIds.add(operation.ownerItemId);
	planned = prepareLineRules(
		config,
		planned,
		operation.line,
		operation.ownerItemId,
		path,
		requireItem,
	);
	if (planned === undefined) return undefined;
	planned = prepareTargetDropRules(config, planned, operation, targetItemId, path, requireItem);
	if (planned === undefined) return undefined;
	const reservations: Array<{
		readonly itemId: string;
		readonly quantity: number;
	}> = [];
	const chargePayments: ChargePayment[] = [];
	for (const input of operation.line.input) {
		switch (input.type) {
			case "materials": {
				const itemId = input.selector.itemId;
				const quantity = input.quantity.min;
				planned = requireItem(planned, itemId, quantity, false, path);
				if (planned === undefined) return undefined;
				if (input.mode === "consume") {
					if (!removeEditorSimulationItem(planned, itemId, quantity, true))
						return undefined;
				} else {
					if (!moveEditorSimulationItem(config, planned, itemId, quantity, "job"))
						return undefined;
					planned.infrastructureItemIds.add(itemId);
					reservations.push({
						itemId,
						quantity,
					});
				}
				if (input.charges !== undefined) {
					if (input.charges.from !== "self") return undefined;
					chargePayments.push({
						cost: input.charges.cost,
						itemId: operation.ownerItemId,
						location: "board",
						owner: true,
					});
				}
				break;
			}
			case "deposit": {
				const itemId = input.query.selector.itemId;
				const cost = input.charges?.cost;
				if (cost === undefined || input.charges?.from !== "target") return undefined;
				planned = ensureWhen(
					config,
					planned,
					{
						query: input.query,
						type: "exists",
					},
					operation.ownerItemId,
					path,
					requireItem,
				);
				if (planned === undefined) return undefined;
				chargePayments.push({
					cost,
					itemId,
					location: "board",
					owner: itemId === operation.ownerItemId,
				});
				break;
			}
			case "simple":
				if (input.charges !== undefined) {
					if (input.charges.from !== "self") return undefined;
					chargePayments.push({
						cost: input.charges.cost,
						itemId: operation.ownerItemId,
						location: "board",
						owner: true,
					});
				}
				break;
		}
	}
	const aggregatedChargePayments: ChargePayment[] = [];
	for (const payment of chargePayments) {
		const previous = aggregatedChargePayments.find(
			(candidate) =>
				candidate.itemId === payment.itemId && candidate.location === payment.location,
		);
		if (previous === undefined) aggregatedChargePayments.push(payment);
		else {
			aggregatedChargePayments.splice(aggregatedChargePayments.indexOf(previous), 1, {
				...previous,
				cost: previous.cost + payment.cost,
				owner: previous.owner || payment.owner,
			});
		}
	}
	for (const payment of aggregatedChargePayments) {
		planned = ensureChargePayment(config, planned, payment, path, requireItem);
		if (planned === undefined) return undefined;
	}
	if (!lineEnabled(planned, operation.line, operation.ownerItemId)) return undefined;
	let ownerDepleted = false;
	for (const payment of aggregatedChargePayments) {
		const result = spendEditorSimulationCharge(
			planned,
			payment.itemId,
			payment.cost,
			payment.location,
		);
		if (result === undefined) return undefined;
		if (!result.depleted) continue;
		if (payment.owner) ownerDepleted = true;
		else {
			const output = config.items[payment.itemId]?.charges?.output;
			if (!applyOutput(config, planned, output, scenario, targetItemId, payment.itemId))
				return undefined;
		}
	}
	planned = prepareLineRules(
		config,
		planned,
		operation.line,
		operation.ownerItemId,
		path,
		requireItem,
	);
	if (planned === undefined || !lineEnabled(planned, operation.line, operation.ownerItemId))
		return undefined;
	const runtimeMs = resolveLineRuntime(planned, operation.line, operation.ownerItemId);
	planned.runtimeMs += runtimeMs;
	if (
		!applyOutput(
			config,
			planned,
			operation.output,
			scenario,
			targetItemId,
			operation.ownerItemId,
		)
	)
		return undefined;
	if (ownerDepleted) {
		const output = config.items[operation.ownerItemId]?.charges?.output;
		if (!applyOutput(config, planned, output, scenario, targetItemId, operation.ownerItemId))
			return undefined;
	}
	for (const reservation of reservations)
		if (
			!returnReservedEditorSimulationItem(
				config,
				planned,
				reservation.itemId,
				reservation.quantity,
				"job",
			)
		)
			return undefined;
	const previous = planned.operations.get(operation.id);
	planned.operations.set(operation.id, {
		id: operation.id,
		ownerItemId: operation.ownerItemId,
		lineId: operation.line.id,
		label: operation.line.title,
		runs: (previous?.runs ?? 0) + 1,
		runtimeMs: (previous?.runtimeMs ?? 0) + runtimeMs,
	});
	return planned;
};

const readPotentialYield = (
	operation: EditorSimulationOperation,
	scenario: EditorItemSimulationScenario,
	targetItemId: string,
) =>
	Math.max(
		...[
			true,
			false,
		].map(
			(active) =>
				resolveEditorSimulationOutput({
					evaluateWhen: () => active,
					output: operation.output,
					scenario,
					targetItemId,
				}).find((output) => output.itemId === targetItemId)?.quantity ?? 0,
		),
	);

interface EditorSimulationCandidate {
	readonly advancesChargeOutput: boolean;
	readonly operation: EditorSimulationOperation;
	readonly targetYield: number;
}

type EditorSimulationCandidateIndex = ReadonlyMap<
	EditorItemSimulationScenario,
	ReadonlyMap<string, ReadonlyArray<EditorSimulationCandidate>>
>;

const indexEditorSimulationCandidates = (
	config: GameConfigSchema.Type,
	operations: ReadonlyArray<EditorSimulationOperation>,
): EditorSimulationCandidateIndex => {
	const index = new Map<EditorItemSimulationScenario, Map<string, EditorSimulationCandidate[]>>();
	for (const scenario of [
		"best",
		"expected",
		"guaranteed",
	] as const)
		index.set(scenario, new Map());
	for (const operation of operations) {
		const directItemIds = new Set(
			operation.output.set.flatMap((set) =>
				set.roll.flatMap((roll) =>
					roll.type === "weight"
						? roll.drop.flatMap((candidate) =>
								candidate.drop.map((drop) => drop.itemId),
							)
						: roll.drop.map((drop) => drop.itemId),
				),
			),
		);
		const chargeOutputs: OutputSchema.Type[] = [];
		for (const input of operation.line.input) {
			if (input.charges?.from === "self") {
				const output = config.items[operation.ownerItemId]?.charges?.output;
				if (output !== undefined) chargeOutputs.push(output);
			}
			if (input.type === "deposit" && input.charges?.from === "target") {
				const output = config.items[input.query.selector.itemId]?.charges?.output;
				if (output !== undefined) chargeOutputs.push(output);
			}
		}
		const chargeItemIds = new Set(
			chargeOutputs.flatMap((output) =>
				output.set.flatMap((set) =>
					set.roll.flatMap((roll) =>
						roll.type === "weight"
							? roll.drop.flatMap((candidate) =>
									candidate.drop.map((drop) => drop.itemId),
								)
							: roll.drop.map((drop) => drop.itemId),
					),
				),
			),
		);
		const itemIds = new Set([
			...directItemIds,
			...chargeItemIds,
		]);
		for (const scenario of [
			"best",
			"expected",
			"guaranteed",
		] as const)
			for (const itemId of itemIds) {
				const directYield = readPotentialYield(operation, scenario, itemId);
				const chargeYield = Math.max(
					0,
					...chargeOutputs.map(
						(output) =>
							resolveEditorSimulationOutput({
								evaluateWhen: () => true,
								output,
								scenario,
								targetItemId: itemId,
							}).find((drop) => drop.itemId === itemId)?.quantity ?? 0,
					),
				);
				const targetYield = Math.max(directYield, chargeYield);
				if (targetYield <= 0) continue;
				const candidates = index.get(scenario)?.get(itemId) ?? [];
				candidates.push({
					advancesChargeOutput: chargeYield > 0 && directYield <= 0,
					operation,
					targetYield,
				});
				index.get(scenario)?.set(itemId, candidates);
			}
	}
	return index;
};

const outputCanYield = (
	output: OutputSchema.Type | undefined,
	scenario: EditorItemSimulationScenario,
	targetItemId: string,
) =>
	output !== undefined &&
	resolveEditorSimulationOutput({
		evaluateWhen: () => true,
		output,
		scenario,
		targetItemId,
	}).some((drop) => drop.itemId === targetItemId && drop.quantity > 0);

const runMerge = (
	config: GameConfigSchema.Type,
	state: EditorSimulationState,
	sourceItemId: string,
	rule: MergeSchema.Type,
	scenario: EditorItemSimulationScenario,
	targetItemId: string,
	path: ReadonlySet<string>,
	requireItem: RequireItem,
): EditorSimulationState | undefined => {
	const receivingItemId = rule.target.itemId;
	const sourceQuantity = sourceItemId === receivingItemId ? 2 : 1;
	let planned = requireItem(state, sourceItemId, sourceQuantity, false, path);
	if (planned === undefined) return undefined;
	planned = requireItem(planned, receivingItemId, sourceQuantity, false, path);
	if (planned === undefined) return undefined;
	if (!moveEditorSimulationItem(config, planned, sourceItemId, sourceQuantity, "board"))
		return undefined;
	if (
		sourceItemId !== receivingItemId &&
		!moveEditorSimulationItem(config, planned, receivingItemId, 1, "board")
	)
		return undefined;
	if (rule.action === "consume" && !removeEditorSimulationItem(planned, sourceItemId, 1, true))
		return undefined;
	if (rule.effect !== "keep") {
		if (!removeEditorSimulationItem(planned, receivingItemId, 1, true)) return undefined;
		if (
			rule.effect === "replace" &&
			!addEditorSimulationOutput(config, planned, rule.result, 1)
		)
			return undefined;
	}
	if (!applyOutput(config, planned, rule.output, scenario, targetItemId, sourceItemId))
		return undefined;
	const operationId = `merge:${sourceItemId}:${receivingItemId}`;
	const previous = planned.operations.get(operationId);
	planned.operations.set(operationId, {
		id: operationId,
		ownerItemId: sourceItemId,
		lineId: operationId,
		label: `Merge ${sourceItemId} into ${receivingItemId}`,
		runs: (previous?.runs ?? 0) + 1,
		runtimeMs: previous?.runtimeMs ?? 0,
	});
	return planned;
};

const runTemporaryExpiry = (
	config: GameConfigSchema.Type,
	state: EditorSimulationState,
	temporaryItemId: string,
	scenario: EditorItemSimulationScenario,
	targetItemId: string,
	path: ReadonlySet<string>,
	requireItem: RequireItem,
): EditorSimulationState | undefined => {
	const item = config.items[temporaryItemId];
	if (item?.type !== "temporary" || item.output === undefined) return undefined;
	let planned = requireItem(state, temporaryItemId, 1, false, path);
	if (planned === undefined) return undefined;
	if (!moveEditorSimulationItem(config, planned, temporaryItemId, 1, "board")) return undefined;
	if (!removeEditorSimulationItem(planned, temporaryItemId, 1, true)) return undefined;
	planned.runtimeMs += Math.ceil(item.durationMs / 200) * 200;
	if (!applyOutput(config, planned, item.output, scenario, targetItemId, temporaryItemId))
		return undefined;
	const operationId = `expiry:${temporaryItemId}`;
	const previous = planned.operations.get(operationId);
	planned.operations.set(operationId, {
		id: operationId,
		ownerItemId: temporaryItemId,
		lineId: operationId,
		label: `Expire ${temporaryItemId}`,
		runs: (previous?.runs ?? 0) + 1,
		runtimeMs: (previous?.runtimeMs ?? 0) + Math.ceil(item.durationMs / 200) * 200,
	});
	return planned;
};

const estimateScenario = (
	config: GameConfigSchema.Type,
	candidateIndex: EditorSimulationCandidateIndex,
	itemId: string,
	quantity: number,
	scenario: EditorItemSimulationScenario,
): EditorItemSimulationScenarioResult => {
	const initialState = makeEditorSimulationState(config);
	const requireItem: RequireItem = (state, requiredItemId, requiredQuantity, consume, path) => {
		let planned = state;
		if ((planned.stock.get(requiredItemId) ?? 0) + 1e-9 < requiredQuantity) {
			if (path.has(requiredItemId)) return undefined;
			const nextPath = new Set(path).add(requiredItemId);
			let runs = 0;
			while ((planned.stock.get(requiredItemId) ?? 0) + 1e-9 < requiredQuantity) {
				if (runs >= maximumRunsPerRequirement) return undefined;
				runs += 1;
				const candidates = [
					...(candidateIndex.get(scenario)?.get(requiredItemId) ?? []),
				].sort((left, right) => {
					const leftOwnerAvailable =
						(planned.stock.get(left.operation.ownerItemId) ?? 0) >= 1;
					const rightOwnerAvailable =
						(planned.stock.get(right.operation.ownerItemId) ?? 0) >= 1;
					if (leftOwnerAvailable !== rightOwnerAvailable)
						return leftOwnerAvailable ? -1 : 1;
					return (
						left.operation.line.runtimeMs / left.targetYield -
							right.operation.line.runtimeMs / right.targetYield ||
						left.operation.id.localeCompare(right.operation.id)
					);
				});
				let advanced = false;
				for (const { advancesChargeOutput, operation } of candidates) {
					const candidate = cloneEditorSimulationState(planned);
					const before = candidate.stock.get(requiredItemId) ?? 0;
					const completed = runOperation(
						config,
						candidate,
						operation,
						scenario,
						requiredItemId,
						nextPath,
						requireItem,
					);
					if (completed === undefined) continue;
					const increased = (completed.stock.get(requiredItemId) ?? 0) > before + 1e-9;
					if (!increased && !advancesChargeOutput) continue;
					planned = completed;
					advanced = true;
					break;
				}
				if (!advanced)
					for (const { rule, sourceItemId } of Object.values(config.items).flatMap(
						(source) =>
							(source.merge ?? [])
								.filter(
									(rule) =>
										(rule.effect === "replace" &&
											rule.result === requiredItemId) ||
										outputCanYield(rule.output, scenario, requiredItemId),
								)
								.map((rule) => ({
									rule,
									sourceItemId: source.id,
								})),
					)) {
						const completed = runMerge(
							config,
							cloneEditorSimulationState(planned),
							sourceItemId,
							rule,
							scenario,
							requiredItemId,
							nextPath,
							requireItem,
						);
						if (
							completed === undefined ||
							(completed.stock.get(requiredItemId) ?? 0) <=
								(planned.stock.get(requiredItemId) ?? 0) + 1e-9
						)
							continue;
						planned = completed;
						advanced = true;
						break;
					}
				if (!advanced)
					for (const temporary of Object.values(config.items).filter(
						(item) =>
							item.type === "temporary" &&
							outputCanYield(item.output, scenario, requiredItemId),
					)) {
						const completed = runTemporaryExpiry(
							config,
							cloneEditorSimulationState(planned),
							temporary.id,
							scenario,
							requiredItemId,
							nextPath,
							requireItem,
						);
						if (
							completed === undefined ||
							(completed.stock.get(requiredItemId) ?? 0) <=
								(planned.stock.get(requiredItemId) ?? 0) + 1e-9
						)
							continue;
						planned = completed;
						advanced = true;
						break;
					}
				if (!advanced) return undefined;
			}
		}
		if (consume && !removeEditorSimulationItem(planned, requiredItemId, requiredQuantity, true))
			return undefined;
		return planned;
	};
	const result = requireItem(initialState, itemId, quantity, false, new Set());
	if (result === undefined)
		return {
			scenario,
			status: "no-finite-path",
			cost: [],
			totalCostQuantity: 0,
			infrastructureItemIds: new Set(),
			operations: [],
			warnings: [
				...initialState.warnings,
				"No finite gameplay-valid path satisfies production, rules, storage scopes, charges, and configured finite sources.",
			],
		};
	const cost = [
		...result.consumed,
	]
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([costItemId, costQuantity]) => ({
			itemId: costItemId,
			quantity: costQuantity,
		}));
	return {
		scenario,
		status: "estimated",
		runtimeMs: result.runtimeMs,
		cost,
		totalCostQuantity: cost.reduce((total, costItem) => total + costItem.quantity, 0),
		infrastructureItemIds: result.infrastructureItemIds,
		operations: [
			...result.operations.values(),
		],
		warnings: [
			...result.warnings,
		],
	};
};

export namespace createEditorItemSimulatorFx {
	export interface Service {
		readonly simulateFx: (
			itemId: string,
			quantity?: number,
		) => Effect.Effect<EditorItemSimulation>;
	}
}

/** Creates one reusable editor-only gameplay simulator over an immutable config snapshot. */
export const createEditorItemSimulatorFx = Effect.fn("createEditorItemSimulatorFx")(
	(config: GameConfigSchema.Type) =>
		Effect.sync((): createEditorItemSimulatorFx.Service => {
			const operations = readEditorSimulationOperations(config);
			const candidateIndex = indexEditorSimulationCandidates(config, operations);
			return {
				simulateFx: Effect.fn("EditorItemSimulator.simulateFx")(
					(itemId: string, quantity = 1) =>
						Effect.sync((): EditorItemSimulation => {
							if (config.items[itemId] === undefined)
								throw new Error(`Item ${itemId} does not exist.`);
							return {
								itemId,
								quantity,
								scenarios: (
									[
										"best",
										"expected",
										"guaranteed",
									] as const
								).map((scenario) =>
									estimateScenario(
										config,
										candidateIndex,
										itemId,
										quantity,
										scenario,
									),
								),
							};
						}),
				),
			};
		}),
);
