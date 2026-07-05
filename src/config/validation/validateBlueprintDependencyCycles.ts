import { z } from "zod";
import type { GameConfig } from "~/config/GameConfigTypes";
import { GameDropEffectSchema } from "~/config/schema/GameDropEffectSchema";
import { GameLineEffectSchema } from "~/config/schema/GameLineEffectSchema";
import { ResolvedDomainSelectorSchema } from "~/config/schema/GameDomainSelectorSchema";
import { addIssue, type GameConfigIssuePath } from "~/config/validation/GameConfigValidationCommon";
import {
	readActivationOutputEffectEntries,
	readActivationOutputItemIds,
	readConfigCraftRecipes,
	readConfigLines,
} from "~/config/validation/GameConfigValidationReaders";
import { readDomainSelectorIds } from "~/config/validation/GameConfigSelectorValidation";

type BlueprintDependencyEdge = {
	path: GameConfigIssuePath;
	toBlueprintItemId: string;
	viaItemId: string;
};

type BlueprintDependencyCollector = {
	blueprintItemIds: ReadonlySet<string>;
	blueprintItemIdsByCraftResultItemId: ReadonlyMap<string, readonly string[]>;
	edgesByBlueprintItemId: Map<string, BlueprintDependencyEdge[]>;
};

type BlueprintDependencyItem = {
	fromBlueprintItemId: string;
	itemId: string;
	path: GameConfigIssuePath;
};

const addBlueprintDependencyItem = (
	collector: BlueprintDependencyCollector,
	item: BlueprintDependencyItem,
) => {
	for (const toBlueprintItemId of readBlueprintDependenciesForItem({
		blueprintItemIds: collector.blueprintItemIds,
		blueprintItemIdsByCraftResultItemId: collector.blueprintItemIdsByCraftResultItemId,
		itemId: item.itemId,
	})) {
		const edges = collector.edgesByBlueprintItemId.get(item.fromBlueprintItemId) ?? [];
		edges.push({
			path: item.path,
			toBlueprintItemId,
			viaItemId: item.itemId,
		});
		collector.edgesByBlueprintItemId.set(item.fromBlueprintItemId, edges);
	}
};

const createBlueprintDependencyCollector = (config: GameConfig): BlueprintDependencyCollector => {
	const blueprintItemIds = readBlueprintItemIds(config);
	return {
		blueprintItemIds,
		blueprintItemIdsByCraftResultItemId: readBlueprintItemIdsByCraftResultItemId(
			config,
			blueprintItemIds,
		),
		edgesByBlueprintItemId: new Map(),
	};
};

const collectBlueprintDependencyEdges = (config: GameConfig) => {
	const collector = createBlueprintDependencyCollector(config);
	const addDependencyItem = (item: BlueprintDependencyItem) =>
		addBlueprintDependencyItem(collector, item);

	collectCraftRecipeBlueprintDependencies({
		addDependencyItem,
		blueprintItemIds: collector.blueprintItemIds,
		config,
	});
	collectLineBlueprintDependencies({
		addDependencyItem,
		blueprintItemIds: collector.blueprintItemIds,
		config,
	});
	collectMergeBlueprintDependencies({
		addDependencyItem,
		blueprintItemIds: collector.blueprintItemIds,
		config,
	});

	return collector;
};

const addBlueprintDependencyCycleIssue = ({
	config,
	ctx,
	cycle,
}: {
	config: GameConfig;
	ctx: z.RefinementCtx;
	cycle: ReturnType<typeof readBlueprintDependencyCycles>[number];
}) => {
	const firstCycleEdge = cycle.edges[0];
	const issuePath = firstCycleEdge?.path ?? [
		"items",
		cycle.blueprintItemIds[0] ?? "blueprints",
	];
	const cycleLabel = cycle.blueprintItemIds
		.map((itemId) => readBlueprintItemDisplayName(config, itemId))
		.join(" -> ");
	const viaLabel = firstCycleEdge ? ` via required item "${firstCycleEdge.viaItemId}"` : "";

	addIssue(
		ctx,
		issuePath,
		`Blueprint dependency cycle detected${viaLabel}: ${cycleLabel}. Blueprint progression must not require itself directly or through another blueprint/building chain.`,
	);
};

export const validateBlueprintDependencyCycles = (ctx: z.RefinementCtx, config: GameConfig) => {
	const collector = collectBlueprintDependencyEdges(config);
	for (const cycle of readBlueprintDependencyCycles({
		blueprintItemIds: collector.blueprintItemIds,
		edgesByBlueprintItemId: collector.edgesByBlueprintItemId,
	})) {
		addBlueprintDependencyCycleIssue({
			config,
			ctx,
			cycle,
		});
	}
};

const readBlueprintItemIds = (config: GameConfig) =>
	new Set(
		Object.entries(config.items)
			.filter(([itemId, item]) => {
				const primaryAsset = config.assets[item.assetIds[0]];

				return (
					itemId.startsWith("item:blueprint-") ||
					item.tags.includes("blueprint") ||
					primaryAsset?.render === "blueprint"
				);
			})
			.map(([itemId]) => itemId),
	);

const readBlueprintItemIdsByCraftResultItemId = (
	config: GameConfig,
	blueprintItemIds: ReadonlySet<string>,
) => {
	const result = new Map<string, string[]>();

	for (const [craftRecipeId, recipe] of readConfigCraftRecipes(config)) {
		if (!blueprintItemIds.has(craftRecipeId)) continue;
		result.set(recipe.resultItemId, [
			...(result.get(recipe.resultItemId) ?? []),
			craftRecipeId,
		]);
	}

	return result;
};

const readBlueprintDependenciesForItem = ({
	blueprintItemIds,
	blueprintItemIdsByCraftResultItemId,
	itemId,
}: {
	blueprintItemIds: ReadonlySet<string>;
	blueprintItemIdsByCraftResultItemId: ReadonlyMap<string, readonly string[]>;
	itemId: string;
}) => {
	const dependencies = new Set<string>();
	if (blueprintItemIds.has(itemId)) dependencies.add(itemId);
	for (const blueprintItemId of blueprintItemIdsByCraftResultItemId.get(itemId) ?? []) {
		dependencies.add(blueprintItemId);
	}
	return dependencies;
};

const collectCraftRecipeBlueprintDependencies = ({
	addDependencyItem,
	blueprintItemIds,
	config,
}: {
	addDependencyItem: (props: {
		fromBlueprintItemId: string;
		itemId: string;
		path: GameConfigIssuePath;
	}) => void;
	blueprintItemIds: ReadonlySet<string>;
	config: GameConfig;
}) => {
	for (const [craftRecipeId, recipe] of readConfigCraftRecipes(config)) {
		if (!blueprintItemIds.has(craftRecipeId)) continue;

		for (const [inputIndex, input] of recipe.inputs.entries()) {
			addDependencyItem({
				fromBlueprintItemId: craftRecipeId,
				itemId: input.itemId,
				path: [
					"items",
					craftRecipeId,
					"craft",
					"inputs",
					inputIndex,
					"itemId",
				],
			});
		}

		collectLineEffectDependencyItems({
			addDependencyItem,
			config,
			fromBlueprintItemId: craftRecipeId,
			lineEffects: recipe.effects ?? [],
			path: [
				"items",
				craftRecipeId,
				"craft",
				"effects",
			],
		});
	}
};

const collectLineBlueprintDependencies = ({
	addDependencyItem,
	blueprintItemIds,
	config,
}: {
	addDependencyItem: (props: {
		fromBlueprintItemId: string;
		itemId: string;
		path: GameConfigIssuePath;
	}) => void;
	blueprintItemIds: ReadonlySet<string>;
	config: GameConfig;
}) => {
	for (const { line, lineIndex, linePath, ownerItemId } of readConfigLines(config)) {
		const outputEntries = readActivationOutputEffectEntries({
			output: line.output ?? [],
			path: [
				...linePath,
				"output",
			],
		});

		for (const outputEntry of outputEntries) {
			if (!blueprintItemIds.has(outputEntry.itemId)) continue;
			const fromBlueprintItemId = outputEntry.itemId;
			addDependencyItem({
				fromBlueprintItemId,
				itemId: ownerItemId,
				path:
					lineIndex === undefined
						? [
								...linePath,
								"id",
							]
						: [
								"items",
								ownerItemId,
								"producer",
								"lines",
								lineIndex,
								"id",
							],
			});

			for (const [inputIndex, input] of (line.inputs ?? []).entries()) {
				addDependencyItem({
					fromBlueprintItemId,
					itemId: input.itemId,
					path: [
						...linePath,
						"inputs",
						inputIndex,
						"itemId",
					],
				});
			}

			collectLineEffectDependencyItems({
				addDependencyItem,
				config,
				fromBlueprintItemId,
				lineEffects: outputEntry.effects,
				path: [
					...outputEntry.path,
					"effects",
				],
			});
		}
	}
};

const collectMergeBlueprintDependencies = ({
	addDependencyItem,
	blueprintItemIds,
	config,
}: {
	addDependencyItem: (props: {
		fromBlueprintItemId: string;
		itemId: string;
		path: GameConfigIssuePath;
	}) => void;
	blueprintItemIds: ReadonlySet<string>;
	config: GameConfig;
}) => {
	for (const [sourceItemId, item] of Object.entries(config.items)) {
		for (const [mergeIndex, merge] of (item.merges ?? []).entries()) {
			const outputBlueprintIds = [
				...("resultItemId" in merge
					? [
							merge.resultItemId,
						]
					: []),
				...readActivationOutputItemIds(merge.output ?? []),
			].filter((itemId) => blueprintItemIds.has(itemId));
			for (const blueprintItemId of outputBlueprintIds) {
				addDependencyItem({
					fromBlueprintItemId: blueprintItemId,
					itemId: sourceItemId,
					path: [
						"items",
						sourceItemId,
						"merges",
						mergeIndex,
					],
				});
				addDependencyItem({
					fromBlueprintItemId: blueprintItemId,
					itemId: merge.withItemId,
					path: [
						"items",
						sourceItemId,
						"merges",
						mergeIndex,
						"withItemId",
					],
				});
			}
		}
	}
};

type GameConfigRuntimeEffect =
	| z.infer<typeof GameLineEffectSchema>
	| z.infer<typeof GameDropEffectSchema>;

const collectLineEffectDependencyItems = ({
	addDependencyItem,
	config,
	fromBlueprintItemId,
	lineEffects,
	path,
}: {
	addDependencyItem: (props: {
		fromBlueprintItemId: string;
		itemId: string;
		path: GameConfigIssuePath;
	}) => void;
	config: GameConfig;
	fromBlueprintItemId: string;
	lineEffects: readonly GameConfigRuntimeEffect[];
	path: GameConfigIssuePath;
}) => {
	for (const [lineEffectIndex, lineEffect] of lineEffects.entries()) {
		if (lineEffect.kind === "grant.require") {
			collectGrantDependencyItems({
				addDependencyItem,
				config,
				fromBlueprintItemId,
				selector: lineEffect.selector,
				path: [
					...path,
					lineEffectIndex,
					"selector",
				],
			});
		}

		if (lineEffect.kind === "nearby.require") {
			for (const itemId of readDomainSelectorIds(
				lineEffect.items as z.infer<typeof ResolvedDomainSelectorSchema>,
			)) {
				addDependencyItem({
					fromBlueprintItemId,
					itemId,
					path: [
						...path,
						lineEffectIndex,
						"items",
					],
				});
			}
		}
	}
};

const collectGrantDependencyItems = ({
	addDependencyItem,
	config,
	fromBlueprintItemId,
	selector,
	path,
}: {
	addDependencyItem: (props: {
		fromBlueprintItemId: string;
		itemId: string;
		path: GameConfigIssuePath;
	}) => void;
	config: GameConfig;
	fromBlueprintItemId: string;
	selector: z.infer<typeof ResolvedDomainSelectorSchema> | undefined;
	path: GameConfigIssuePath;
}) => {
	if (!selector) return;

	const grantSourceItemIdsByGrantId = readPassiveGrantSourceItemIdsByGrantId(config);
	for (const grantId of readDomainSelectorIds(selector)) {
		for (const itemId of grantSourceItemIdsByGrantId.get(grantId) ?? []) {
			addDependencyItem({
				fromBlueprintItemId,
				itemId,
				path,
			});
		}
	}
};

const readPassiveGrantSourceItemIdsByGrantId = (config: GameConfig) => {
	const result = new Map<string, string[]>();
	for (const [itemId, item] of Object.entries(config.items)) {
		for (const effect of item.effects ?? []) {
			for (const grantId of effect.grants.map((grant) => grant.id)) {
				result.set(grantId, [
					...(result.get(grantId) ?? []),
					itemId,
				]);
			}
		}
	}
	return result;
};

type BlueprintDependencyCycle = {
	blueprintItemIds: string[];
	edges: BlueprintDependencyEdge[];
};

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

const readBlueprintDependencyCycles = ({
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

const readBlueprintItemDisplayName = (config: GameConfig, itemId: string) =>
	config.items[itemId]?.name ?? itemId;
