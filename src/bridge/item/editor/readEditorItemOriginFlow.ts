import { Effect } from "effect";

import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type {
	EditorInput,
	EditorItem,
	EditorLine,
	EditorOutput,
} from "~/bridge/item/editor/EditorItemModel";

export type EditorItemOriginNodeStatus = "starter" | "reachable" | "blocked" | "cycle";
export type EditorItemOriginOperationKind = "line" | "charges" | "merge" | "expiry";
export type EditorItemOriginOutputKind = "guaranteed" | "chance" | "weighted" | "replace";

export interface EditorItemOriginOperationPort {
	readonly id: string;
	readonly itemId: string;
	readonly label: string;
}

export interface EditorItemOriginOperationOutputPort extends EditorItemOriginOperationPort {
	readonly placement: "drop" | "random" | undefined;
	readonly selectionKind: EditorItemOriginOutputKind;
	readonly weightedSet: boolean;
}

export interface EditorItemOriginOperation {
	readonly id: string;
	readonly inputs: ReadonlyArray<EditorItemOriginOperationPort>;
	readonly kind: EditorItemOriginOperationKind;
	readonly label: string;
	readonly outputs: ReadonlyArray<EditorItemOriginOperationOutputPort>;
	readonly status: Exclude<EditorItemOriginNodeStatus, "starter" | "cycle">;
}

export interface EditorItemOriginItemNode {
	readonly acquisitionSourceId?: string;
	readonly depth: number;
	readonly id: string;
	readonly itemId: string;
	readonly kind: "item";
	readonly operations: ReadonlyArray<EditorItemOriginOperation>;
	readonly resourceIds: EditorItem["asset"]["default"];
	readonly starterScopes: ReadonlyArray<"Board" | "Inventory" | "Toolbar">;
	readonly status: EditorItemOriginNodeStatus;
	readonly title: string;
	readonly type: EditorItem["type"] | "missing";
}

export type EditorItemOriginNode = EditorItemOriginItemNode;

export interface EditorItemOriginEdge {
	readonly id: string;
	readonly operationId: string;
	readonly role: "input" | "output";
	readonly source: string;
	readonly sourcePortId?: string;
	readonly target: string;
	readonly targetPortId?: string;
}

export interface EditorItemOriginFlow {
	readonly edges: ReadonlyArray<EditorItemOriginEdge>;
	readonly nodes: ReadonlyArray<EditorItemOriginNode>;
	readonly obtainable: boolean | undefined;
}

export type EditorItemOriginFlowPhase = "indexing" | "tracing" | "resolving" | "finalizing";

export interface EditorItemOriginFlowProgress {
	readonly label: string;
	readonly percent: number;
	readonly phase: EditorItemOriginFlowPhase;
}

export interface EditorItemOriginFlowRequest {
	readonly config: GameConfigSchema.Type;
	readonly onProgress?: (progress: EditorItemOriginFlowProgress) => void;
	/** When omitted, the complete game graph is returned. Item mode keeps one Income proof. */
	readonly targetItemId?: string;
}

interface OutputOccurrence {
	readonly itemId: string;
	readonly placement: EditorItemOriginOperationOutputPort["placement"];
	readonly selectionKind: EditorItemOriginOutputKind;
	readonly weightedSet: boolean;
}

interface OutputSource {
	readonly id: string;
	readonly kind: EditorItemOriginOperationKind;
	readonly label: string;
	readonly outputs: ReadonlyArray<OutputOccurrence>;
	readonly ownerItemId: string;
	readonly requirementItemIds: ReadonlyArray<string>;
}

const unique = <Value>(values: ReadonlyArray<Value>): Value[] => [
	...new Set(values),
];

const readOutputOccurrences = (output: EditorOutput | undefined): OutputOccurrence[] => {
	if (output === undefined) return [];
	const weightedSet = output.set.length > 1;
	return output.set.flatMap((set) =>
		set.roll.flatMap((roll) => {
			const selectionKind: EditorItemOriginOutputKind =
				roll.type === "weight"
					? "weighted"
					: roll.type === "chance"
						? "chance"
						: "guaranteed";
			const drops =
				roll.type === "weight"
					? roll.drop.flatMap((candidate) => candidate.drop)
					: roll.drop;
			return drops.map((drop) => ({
				itemId: drop.itemId,
				placement: drop.placement,
				selectionKind,
				weightedSet,
			}));
		}),
	);
};

const dedupeOccurrences = (occurrences: ReadonlyArray<OutputOccurrence>) => {
	const seen = new Set<string>();
	return occurrences.filter((occurrence) => {
		const key = `${occurrence.itemId}:${occurrence.selectionKind}:${occurrence.placement ?? "none"}:${occurrence.weightedSet}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
};

const readInputItemId = (input: EditorInput): string | undefined => {
	switch (input.type) {
		case "simple":
			return undefined;
		case "materials":
			return input.selector.itemId;
		case "deposit":
			return input.query.selector.itemId;
	}
};

const readLineSources = (item: EditorItem, lines: ReadonlyArray<EditorLine>): OutputSource[] =>
	lines.flatMap((line, index) => {
		const outputs = dedupeOccurrences(readOutputOccurrences(line.output));
		if (outputs.length === 0) return [];
		return [
			{
				id: `source:${item.id}:line:${line.id || index}`,
				kind: "line",
				label: line.title || "Production",
				outputs,
				ownerItemId: item.id,
				requirementItemIds: unique([
					item.id,
					...line.input
						.map(readInputItemId)
						.filter((id): id is string => id !== undefined),
				]),
			},
		];
	});

const readItemSources = (item: EditorItem): OutputSource[] => {
	const sources: OutputSource[] = [];
	switch (item.type) {
		case "blueprint":
		case "craft":
		case "stash":
			sources.push(
				...readLineSources(item, [
					item.line,
				]),
			);
			break;
		case "deposit":
		case "producer":
			sources.push(...readLineSources(item, item.lines ?? []));
			break;
	}
	const depletedOutputs = dedupeOccurrences(readOutputOccurrences(item.charges?.output));
	if (depletedOutputs.length > 0) {
		sources.push({
			id: `source:${item.id}:charges`,
			kind: "charges",
			label: "Depletion",
			outputs: depletedOutputs,
			ownerItemId: item.id,
			requirementItemIds: [
				item.id,
			],
		});
	}
	if (item.type === "temporary") {
		const expiryOutputs = dedupeOccurrences(readOutputOccurrences(item.output));
		if (expiryOutputs.length > 0) {
			sources.push({
				id: `source:${item.id}:expiry`,
				kind: "expiry",
				label: "Expiry",
				outputs: expiryOutputs,
				ownerItemId: item.id,
				requirementItemIds: [
					item.id,
				],
			});
		}
	}
	for (const [index, merge] of (item.merge ?? []).entries()) {
		const outputs = readOutputOccurrences(merge.output);
		if (merge.effect === "replace") {
			outputs.push({
				itemId: merge.result,
				placement: undefined,
				selectionKind: "replace",
				weightedSet: false,
			});
		}
		const deduped = dedupeOccurrences(outputs);
		if (deduped.length === 0) continue;
		sources.push({
			id: `source:${item.id}:merge:${index}`,
			kind: "merge",
			label: "Merge",
			outputs: deduped,
			ownerItemId: item.id,
			requirementItemIds: unique([
				item.id,
				merge.target.itemId,
			]),
		});
	}
	return sources;
};

const ProgressLabels: Record<EditorItemOriginFlowPhase, string> = {
	indexing: "Indexing sources",
	tracing: "Tracing flow",
	resolving: "Resolving reachability",
	finalizing: "Preparing flow",
};

const yieldToRenderer = async (signal: AbortSignal) => {
	const abortCause = () => signal.reason ?? new Error("Acquisition graph build interrupted.");
	if (signal.aborted) throw abortCause();
	let interrupt: (() => void) | undefined;
	const interruption = new Promise<never>((_, reject) => {
		interrupt = () => reject(abortCause());
		signal.addEventListener("abort", interrupt, {
			once: true,
		});
	});
	const continuation =
		typeof globalThis.scheduler === "undefined"
			? new Promise<void>((resolve) => setTimeout(resolve, 0))
			: globalThis.scheduler.postTask(() => undefined, {
					priority: "background",
				});
	try {
		await Promise.race([
			continuation,
			interruption,
		]);
		if (signal.aborted) throw abortCause();
	} finally {
		if (interrupt !== undefined) signal.removeEventListener("abort", interrupt);
	}
};

const reportProgress = (
	onProgress: ((progress: EditorItemOriginFlowProgress) => void) | undefined,
	phase: EditorItemOriginFlowPhase,
	percent: number,
) =>
	onProgress?.({
		label: ProgressLabels[phase],
		percent: Math.max(0, Math.min(100, Math.round(percent))),
		phase,
	});

interface OriginSubgraph {
	readonly cycleItemIds: ReadonlySet<string>;
	readonly itemDepths: ReadonlyMap<string, number>;
	readonly sources: ReadonlyArray<OutputSource>;
}

const readIncomeSubgraph = (
	targetItemId: string,
	starters: ReadonlyMap<string, ReadonlySet<string>>,
	sourcesByOutput: ReadonlyMap<string, ReadonlyArray<OutputSource>>,
	sourcesById: ReadonlyMap<string, OutputSource>,
	acquisitionSourceByItem: ReadonlyMap<string, string>,
): OriginSubgraph => {
	const itemDepths = new Map([
		[
			targetItemId,
			0,
		],
	]);
	const tracedItems = new Set<string>();
	const includedSources = new Map<string, OutputSource>();
	const cycleItemIds = new Set<string>();

	const traceItem = (itemId: string, depth: number, activePath: ReadonlyArray<string>) => {
		itemDepths.set(itemId, Math.max(itemDepths.get(itemId) ?? 0, depth));
		const cycleStart = activePath.lastIndexOf(itemId);
		if (cycleStart >= 0) {
			for (const cycleItemId of activePath.slice(cycleStart)) cycleItemIds.add(cycleItemId);
			cycleItemIds.add(itemId);
			return;
		}
		if (tracedItems.has(itemId)) return;
		tracedItems.add(itemId);
		if (starters.has(itemId)) return;

		const witnessedSourceId = acquisitionSourceByItem.get(itemId);
		const witnessedSource =
			witnessedSourceId === undefined ? undefined : sourcesById.get(witnessedSourceId);
		const directSources = [
			...(sourcesByOutput.get(itemId) ?? []),
		].sort((left, right) => left.id.localeCompare(right.id));
		const source = witnessedSource ?? directSources[0];
		if (source === undefined) return;
		includedSources.set(source.id, source);
		const nextPath = [
			...activePath,
			itemId,
		];
		for (const requirementItemId of unique(source.requirementItemIds).sort((left, right) =>
			left.localeCompare(right),
		)) {
			traceItem(requirementItemId, depth + 1, nextPath);
		}
	};
	traceItem(targetItemId, 0, []);
	return {
		cycleItemIds,
		itemDepths,
		sources: [
			...includedSources.values(),
		],
	};
};

const readOperationPortLabel = (itemId: string, items: ReadonlyMap<string, EditorItem>) =>
	items.get(itemId)?.title || itemId;

const readOperation = (
	source: OutputSource,
	items: ReadonlyMap<string, EditorItem>,
	reachableSources: ReadonlySet<string>,
): EditorItemOriginOperation => ({
	id: source.id,
	inputs: unique(source.requirementItemIds)
		.filter((itemId) => itemId !== source.ownerItemId)
		.sort((left, right) => left.localeCompare(right))
		.map((itemId) => ({
			id: `${source.id}:input:${itemId}`,
			itemId,
			label: readOperationPortLabel(itemId, items),
		})),
	kind: source.kind,
	label: source.label,
	outputs: source.outputs.map((output, index) => ({
		id: `${source.id}:output:${index}:${output.itemId}`,
		itemId: output.itemId,
		label: readOperationPortLabel(output.itemId, items),
		placement: output.placement,
		selectionKind: output.selectionKind,
		weightedSet: output.weightedSet,
	})),
	status: reachableSources.has(source.id) ? "reachable" : "blocked",
});

const readItemNode = (
	itemId: string,
	depth: number,
	items: ReadonlyMap<string, EditorItem>,
	starters: ReadonlyMap<string, ReadonlySet<EditorItemOriginItemNode["starterScopes"][number]>>,
	reachableItems: ReadonlySet<string>,
	reachableSources: ReadonlySet<string>,
	sourcesByOwner: ReadonlyMap<string, ReadonlyArray<OutputSource>>,
	acquisitionSourceByItem: ReadonlyMap<string, string>,
	cycleItemIds: ReadonlySet<string> = new Set(),
	includedSourceIds?: ReadonlySet<string>,
): EditorItemOriginItemNode => {
	const item = items.get(itemId);
	const operations = [
		...(sourcesByOwner.get(itemId) ?? []),
	]
		.filter((source) => includedSourceIds === undefined || includedSourceIds.has(source.id))
		.sort((left, right) => left.id.localeCompare(right.id))
		.map((source) => readOperation(source, items, reachableSources));
	return {
		acquisitionSourceId: acquisitionSourceByItem.get(itemId),
		depth,
		id: `item:${itemId}`,
		itemId,
		kind: "item",
		operations,
		resourceIds: item?.asset.default ?? [
			"missing",
		],
		starterScopes: [
			...(starters.get(itemId) ?? []),
		],
		status: starters.has(itemId)
			? "starter"
			: cycleItemIds.has(itemId)
				? "cycle"
				: reachableItems.has(itemId)
					? "reachable"
					: "blocked",
		title: item?.title || itemId,
		type: item?.type ?? "missing",
	};
};

const readEdges = (
	sources: ReadonlyArray<OutputSource>,
	itemsInGraph?: ReadonlySet<string>,
): EditorItemOriginEdge[] => {
	const edges: EditorItemOriginEdge[] = [];
	for (const source of sources) {
		if (itemsInGraph !== undefined && !itemsInGraph.has(source.ownerItemId)) continue;
		for (const requirementItemId of unique(source.requirementItemIds).sort((left, right) =>
			left.localeCompare(right),
		)) {
			if (requirementItemId === source.ownerItemId) continue;
			if (itemsInGraph !== undefined && !itemsInGraph.has(requirementItemId)) continue;
			const targetPortId = `${source.id}:input:${requirementItemId}`;
			edges.push({
				id: `${source.id}:input:${requirementItemId}`,
				operationId: source.id,
				role: "input",
				source: `item:${requirementItemId}`,
				target: `item:${source.ownerItemId}`,
				targetPortId,
			});
		}
		for (const [index, output] of source.outputs.entries()) {
			if (itemsInGraph !== undefined && !itemsInGraph.has(output.itemId)) continue;
			const sourcePortId = `${source.id}:output:${index}:${output.itemId}`;
			edges.push({
				id: `${source.id}:output:${index}:${output.itemId}`,
				operationId: source.id,
				role: "output",
				source: `item:${source.ownerItemId}`,
				sourcePortId,
				target: `item:${output.itemId}`,
			});
		}
	}
	return edges;
};

/** Builds the editor item graph cooperatively. Operations stay embedded in their owning item node. */
export const readEditorItemOriginFlowFx = Effect.fn("readEditorItemOriginFlowFx")(
	({ config, onProgress, targetItemId }: EditorItemOriginFlowRequest) =>
		Effect.promise(async (signal): Promise<EditorItemOriginFlow> => {
			reportProgress(onProgress, "indexing", 0);
			await yieldToRenderer(signal);
			const items = new Map(
				Object.values(config.items).map((item) => [
					item.id,
					item,
				]),
			);
			const starters = new Map<
				string,
				Set<EditorItemOriginItemNode["starterScopes"][number]>
			>();
			const addStarter = (
				itemId: string,
				scope: EditorItemOriginItemNode["starterScopes"][number],
			) => {
				const scopes = starters.get(itemId) ?? new Set();
				scopes.add(scope);
				starters.set(itemId, scopes);
			};
			for (const entry of config.start.board) addStarter(entry.itemId, "Board");
			for (const entry of config.start.inventory) addStarter(entry.itemId, "Inventory");
			for (const entry of config.start.toolbar) addStarter(entry.itemId, "Toolbar");

			const itemValues = Object.values(config.items);
			const sources: OutputSource[] = [];
			for (const [index, item] of itemValues.entries()) {
				sources.push(...readItemSources(item));
				if ((index + 1) % 8 === 0) {
					reportProgress(onProgress, "indexing", ((index + 1) / itemValues.length) * 28);
					await yieldToRenderer(signal);
				}
			}
			sources.sort((left, right) => left.id.localeCompare(right.id));
			const sourcesByOutput = new Map<string, OutputSource[]>();
			const sourcesByOwner = new Map<string, OutputSource[]>();
			const sourcesById = new Map(
				sources.map((source) => [
					source.id,
					source,
				]),
			);
			for (const [index, source] of sources.entries()) {
				const ownerSources = sourcesByOwner.get(source.ownerItemId) ?? [];
				ownerSources.push(source);
				sourcesByOwner.set(source.ownerItemId, ownerSources);
				for (const outputItemId of unique(source.outputs.map(({ itemId }) => itemId))) {
					const matches = sourcesByOutput.get(outputItemId) ?? [];
					matches.push(source);
					sourcesByOutput.set(outputItemId, matches);
				}
				if ((index + 1) % 64 === 0) {
					reportProgress(
						onProgress,
						"indexing",
						28 + ((index + 1) / Math.max(1, sources.length)) * 12,
					);
					await yieldToRenderer(signal);
				}
			}

			reportProgress(onProgress, "resolving", 44);
			await yieldToRenderer(signal);
			const reachableItems = new Set<string>();
			const reachableSources = new Set<string>();
			const acquisitionSourceByItem = new Map<string, string>();
			const waitingSources = new Map<string, OutputSource[]>();
			const remainingRequirements = new Map<string, number>();
			const pendingReachableItems: Array<{
				readonly itemId: string;
				readonly sourceId?: string;
			}> = [
				...[
					...starters.keys(),
				].map((itemId) => ({
					itemId,
				})),
			];
			for (const [index, source] of sources.entries()) {
				const requirementItemIds = unique(source.requirementItemIds);
				remainingRequirements.set(source.id, requirementItemIds.length);
				for (const requirementItemId of requirementItemIds) {
					const waiting = waitingSources.get(requirementItemId) ?? [];
					waiting.push(source);
					waitingSources.set(requirementItemId, waiting);
				}
				if (requirementItemIds.length === 0) {
					reachableSources.add(source.id);
					pendingReachableItems.push(
						...unique(source.outputs.map(({ itemId }) => itemId)).map((itemId) => ({
							itemId,
							sourceId: source.id,
						})),
					);
				}
				if ((index + 1) % 64 === 0) {
					reportProgress(
						onProgress,
						"resolving",
						44 + ((index + 1) / Math.max(1, sources.length)) * 10,
					);
					await yieldToRenderer(signal);
				}
			}
			let resolvedItemCount = 0;
			for (
				let pendingIndex = 0;
				pendingIndex < pendingReachableItems.length;
				pendingIndex += 1
			) {
				const pendingItem = pendingReachableItems[pendingIndex];
				if (pendingItem === undefined || reachableItems.has(pendingItem.itemId)) continue;
				reachableItems.add(pendingItem.itemId);
				if (pendingItem.sourceId !== undefined)
					acquisitionSourceByItem.set(pendingItem.itemId, pendingItem.sourceId);
				for (const source of waitingSources.get(pendingItem.itemId) ?? []) {
					if (reachableSources.has(source.id)) continue;
					const remaining = (remainingRequirements.get(source.id) ?? 1) - 1;
					remainingRequirements.set(source.id, remaining);
					if (remaining !== 0) continue;
					reachableSources.add(source.id);
					pendingReachableItems.push(
						...unique(source.outputs.map(({ itemId }) => itemId)).map((itemId) => ({
							itemId,
							sourceId: source.id,
						})),
					);
				}
				resolvedItemCount += 1;
				if (resolvedItemCount % 32 === 0) {
					reportProgress(
						onProgress,
						"resolving",
						54 + (resolvedItemCount / Math.max(1, pendingReachableItems.length)) * 18,
					);
					await yieldToRenderer(signal);
				}
			}
			reportProgress(onProgress, "resolving", 74);
			await yieldToRenderer(signal);

			reportProgress(onProgress, "tracing", 80);
			const originSubgraph =
				targetItemId === undefined
					? undefined
					: readIncomeSubgraph(
							targetItemId,
							starters,
							sourcesByOutput,
							sourcesById,
							acquisitionSourceByItem,
						);
			reportProgress(onProgress, "finalizing", 92);
			await yieldToRenderer(signal);

			const flow: EditorItemOriginFlow =
				originSubgraph === undefined
					? {
							edges: readEdges(sources),
							nodes: [
								...items.keys(),
							].map((itemId) =>
								readItemNode(
									itemId,
									0,
									items,
									starters,
									reachableItems,
									reachableSources,
									sourcesByOwner,
									acquisitionSourceByItem,
								),
							),
							obtainable: undefined,
						}
					: (() => {
							const itemIds = new Set(originSubgraph.itemDepths.keys());
							const sourceIds = new Set(originSubgraph.sources.map(({ id }) => id));
							return {
								edges: readEdges(originSubgraph.sources, itemIds),
								nodes: [
									...originSubgraph.itemDepths.entries(),
								].map(([itemId, depth]) =>
									readItemNode(
										itemId,
										depth,
										items,
										starters,
										reachableItems,
										reachableSources,
										sourcesByOwner,
										acquisitionSourceByItem,
										originSubgraph.cycleItemIds,
										sourceIds,
									),
								),
								obtainable:
									targetItemId === undefined
										? false
										: reachableItems.has(targetItemId),
							};
						})();
			reportProgress(onProgress, "finalizing", 100);
			return flow;
		}),
);
