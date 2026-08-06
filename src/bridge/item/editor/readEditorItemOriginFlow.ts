import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { Effect } from "effect";
import type {
	EditorInput,
	EditorItem,
	EditorLine,
	EditorOutput,
} from "~/bridge/item/editor/EditorItemModel";

export type EditorItemOriginNodeStatus = "starter" | "reachable" | "blocked" | "cycle";

export interface EditorItemOriginItemNode {
	readonly depth: number;
	readonly id: string;
	readonly itemId: string;
	readonly kind: "item";
	readonly resourceIds: EditorItem["asset"]["default"];
	readonly starterScopes: ReadonlyArray<"Board" | "Inventory" | "Toolbar">;
	readonly status: EditorItemOriginNodeStatus;
	readonly title: string;
	readonly type: EditorItem["type"] | "missing";
}

export interface EditorItemOriginSourceNode {
	readonly depth: number;
	readonly id: string;
	readonly kind: "source";
	readonly label: string;
	readonly placement: "drop" | "random" | undefined;
	readonly selectionKind: "guaranteed" | "chance" | "weighted" | "replace";
	readonly status: Exclude<EditorItemOriginNodeStatus, "starter">;
	readonly sourceKind: "line" | "charges" | "merge" | "expiry";
	readonly weightedSet: boolean;
}

export type EditorItemOriginNode = EditorItemOriginItemNode | EditorItemOriginSourceNode;

export interface EditorItemOriginEdge {
	readonly id: string;
	readonly source: string;
	readonly target: string;
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
	/** When omitted, the complete game graph is returned. */
	readonly targetItemId?: string;
}

interface OutputSource {
	readonly id: string;
	readonly kind: EditorItemOriginSourceNode["sourceKind"];
	readonly label: string;
	readonly outputItemIds: ReadonlyArray<string>;
	/** Item whose authored behavior owns this source and forms the readable acquisition backbone. */
	readonly ownerItemId: string;
	readonly placement: EditorItemOriginSourceNode["placement"];
	readonly requirementItemIds: ReadonlyArray<string>;
	readonly selectionKind: EditorItemOriginSourceNode["selectionKind"];
	readonly weightedSet: boolean;
}

interface OutputOccurrence {
	readonly itemId: string;
	readonly placement: EditorItemOriginSourceNode["placement"];
	readonly selectionKind: Exclude<EditorItemOriginSourceNode["selectionKind"], "replace">;
	readonly weightedSet: boolean;
}

const readOutputOccurrences = (output: EditorOutput | undefined): OutputOccurrence[] => {
	if (output === undefined) return [];
	const weightedSet = output.set.length > 1;
	return output.set.flatMap((set) =>
		set.roll.flatMap((roll) => {
			const selectionKind =
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

const groupOutputOccurrences = (
	idPrefix: string,
	kind: OutputSource["kind"],
	label: string,
	ownerItemId: string,
	requirementItemIds: ReadonlyArray<string>,
	occurrences: ReadonlyArray<OutputOccurrence>,
): OutputSource[] => {
	const groups = new Map<string, OutputOccurrence[]>();
	for (const occurrence of occurrences) {
		const key = `${occurrence.weightedSet ? "weighted-set" : "single-set"}:${occurrence.selectionKind}:${occurrence.placement}`;
		groups.set(key, [
			...(groups.get(key) ?? []),
			occurrence,
		]);
	}
	return [
		...groups.entries(),
	].map(([key, grouped]) => ({
		id: `${idPrefix}:${key}`,
		kind,
		label,
		outputItemIds: unique(grouped.map(({ itemId }) => itemId)),
		ownerItemId,
		placement: grouped[0]?.placement,
		requirementItemIds,
		selectionKind: grouped[0]?.selectionKind ?? "guaranteed",
		weightedSet: grouped[0]?.weightedSet ?? false,
	}));
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
		return groupOutputOccurrences(
			`source:${item.id}:line:${line.id || index}`,
			"line",
			line.title || `${item.title || item.id} production line`,
			item.id,
			[
				item.id,
				...line.input.map(readInputItemId).filter((id): id is string => id !== undefined),
			],
			readOutputOccurrences(line.output),
		);
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
	sources.push(
		...groupOutputOccurrences(
			`source:${item.id}:charges`,
			"charges",
			`${item.title || item.id} depletion`,
			item.id,
			[
				item.id,
			],
			readOutputOccurrences(item.charges?.output),
		),
	);
	if (item.type === "temporary") {
		sources.push(
			...groupOutputOccurrences(
				`source:${item.id}:expiry`,
				"expiry",
				`${item.title || item.id} expiry`,
				item.id,
				[
					item.id,
				],
				readOutputOccurrences(item.output),
			),
		);
	}
	for (const [index, merge] of (item.merge ?? []).entries()) {
		const requirementItemIds = [
			item.id,
			merge.target.itemId,
		];
		sources.push(
			...groupOutputOccurrences(
				`source:${item.id}:merge:${index}`,
				"merge",
				`${item.title || item.id} merge`,
				item.id,
				requirementItemIds,
				readOutputOccurrences(merge.output),
			),
		);
		if (merge.effect === "replace") {
			sources.push({
				id: `source:${item.id}:merge:${index}:replace`,
				kind: "merge",
				label: `${item.title || item.id} replacement`,
				outputItemIds: [
					merge.result,
				],
				ownerItemId: item.id,
				placement: undefined,
				requirementItemIds,
				selectionKind: "replace",
				weightedSet: false,
			});
		}
	}
	return sources;
};

const unique = <Value>(values: ReadonlyArray<Value>): Value[] => [
	...new Set(values),
];

const ProgressLabels: Record<EditorItemOriginFlowPhase, string> = {
	indexing: "Indexing item sources",
	tracing: "Tracing acquisition paths",
	resolving: "Resolving starter reachability",
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
	readonly edges: ReadonlyArray<EditorItemOriginEdge>;
	readonly itemDepths: ReadonlyMap<string, number>;
	readonly sources: ReadonlyArray<OutputSource>;
}

/**
 * Keeps every direct producer of the target, then follows one concrete acquisition witness for
 * each prerequisite. Expanding every alternative recursively turns common resources into almost
 * the complete game graph and makes a focused item flow both unreadable and expensive to lay out.
 */
const readOriginSubgraph = (
	targetItemId: string,
	starters: ReadonlyMap<string, ReadonlySet<string>>,
	sourcesByOutput: ReadonlyMap<string, ReadonlyArray<OutputSource>>,
	sourcesById: ReadonlyMap<string, OutputSource>,
	acquisitionSourceByItem: ReadonlyMap<string, string>,
	reachableItems: ReadonlySet<string>,
): OriginSubgraph => {
	const itemDepths = new Map([
		[
			targetItemId,
			0,
		],
	]);
	const tracedItems = new Set<string>();
	const includedSources = new Map<string, OutputSource>();
	const edges = new Map<string, EditorItemOriginEdge>();
	const cycleItemIds = new Set<string>();

	const traceItem = (
		itemId: string,
		depth: number,
		activePath: ReadonlyArray<string>,
		includeEveryDirectSource = false,
	) => {
		itemDepths.set(itemId, Math.max(itemDepths.get(itemId) ?? 0, depth));
		const cycleStart = activePath.lastIndexOf(itemId);
		if (cycleStart >= 0) {
			for (const cycleItemId of activePath.slice(cycleStart)) cycleItemIds.add(cycleItemId);
			cycleItemIds.add(itemId);
			return;
		}
		if (tracedItems.has(itemId)) return;
		tracedItems.add(itemId);
		if (!includeEveryDirectSource && starters.has(itemId)) return;

		const witnessedSourceId = acquisitionSourceByItem.get(itemId);
		const witnessedSource =
			witnessedSourceId === undefined ? undefined : sourcesById.get(witnessedSourceId);
		const candidateSources = includeEveryDirectSource
			? (sourcesByOutput.get(itemId) ?? [])
			: witnessedSource === undefined
				? (sourcesByOutput.get(itemId) ?? []).slice(0, 1)
				: [
						witnessedSource,
					];
		const nextPath = [
			...activePath,
			itemId,
		];

		for (const source of candidateSources) {
			includedSources.set(source.id, source);
			const outputEdge: EditorItemOriginEdge = {
				id: `${source.id}->item:${itemId}`,
				source: source.id,
				target: `item:${itemId}`,
			};
			edges.set(outputEdge.id, outputEdge);
			const requirementItemIds = unique(source.requirementItemIds);
			const blockingRequirementItemId = requirementItemIds.find(
				(candidate) => !reachableItems.has(candidate),
			);
			const requirementItemId =
				blockingRequirementItemId ??
				(source.ownerItemId === itemId
					? requirementItemIds.find((candidate) => candidate !== itemId)
					: source.ownerItemId);
			if (requirementItemId !== undefined) {
				const requirementEdge: EditorItemOriginEdge = {
					id: `item:${requirementItemId}->${source.id}`,
					source: `item:${requirementItemId}`,
					target: source.id,
				};
				edges.set(requirementEdge.id, requirementEdge);
				traceItem(requirementItemId, depth + 2, nextPath);
			}
		}
	};
	traceItem(targetItemId, 0, [], true);

	return {
		cycleItemIds,
		edges: [
			...edges.values(),
		],
		itemDepths,
		sources: [
			...includedSources.values(),
		],
	};
};

/**
 * Builds one upstream acquisition flow cooperatively.
 *
 * Work is split into renderer-sized batches. Effect interruption cancels obsolete builds when
 * navigation or project revisions replace the request, while progress remains UI-owned.
 */
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
			const sourcesByOutput = new Map<string, OutputSource[]>();
			const sourcesById = new Map(
				sources.map((source) => [
					source.id,
					source,
				]),
			);
			for (const [index, source] of sources.entries()) {
				for (const outputItemId of unique(source.outputItemIds)) {
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
						...unique(source.outputItemIds).map((itemId) => ({
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
			while (pendingReachableItems.length > 0) {
				const pendingItem = pendingReachableItems.shift();
				if (pendingItem === undefined || reachableItems.has(pendingItem.itemId)) continue;
				const reachableItemId = pendingItem.itemId;
				reachableItems.add(reachableItemId);
				if (pendingItem.sourceId !== undefined) {
					acquisitionSourceByItem.set(reachableItemId, pendingItem.sourceId);
				}
				for (const source of waitingSources.get(reachableItemId) ?? []) {
					if (reachableSources.has(source.id)) continue;
					const remaining = (remainingRequirements.get(source.id) ?? 1) - 1;
					remainingRequirements.set(source.id, remaining);
					if (remaining !== 0) continue;
					reachableSources.add(source.id);
					pendingReachableItems.push(
						...unique(source.outputItemIds).map((itemId) => ({
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
						54 +
							(resolvedItemCount /
								Math.max(1, resolvedItemCount + pendingReachableItems.length)) *
								18,
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
					: readOriginSubgraph(
							targetItemId,
							starters,
							sourcesByOutput,
							sourcesById,
							acquisitionSourceByItem,
							reachableItems,
						);
			reportProgress(onProgress, "finalizing", 92);
			await yieldToRenderer(signal);

			const flow: EditorItemOriginFlow =
				originSubgraph === undefined
					? {
							edges: sources.flatMap((source) => [
								...unique(source.requirementItemIds).map((requirementItemId) => ({
									id: `item:${requirementItemId}->${source.id}`,
									source: `item:${requirementItemId}`,
									target: source.id,
								})),
								...unique(source.outputItemIds).map((outputItemId) => ({
									id: `${source.id}->item:${outputItemId}`,
									source: source.id,
									target: `item:${outputItemId}`,
								})),
							]),
							nodes: [
								...[
									...items.keys(),
								].map((itemId) =>
									readItemNode(itemId, 0, items, starters, reachableItems),
								),
								...sources.map((source) =>
									readSourceNode(source, 1, reachableSources),
								),
							],
							obtainable: undefined,
						}
					: {
							edges: originSubgraph.edges,
							nodes: [
								...[
									...originSubgraph.itemDepths.entries(),
								].map(([itemId, depth]) =>
									readItemNode(
										itemId,
										depth,
										items,
										starters,
										reachableItems,
										originSubgraph.cycleItemIds,
									),
								),
								...originSubgraph.sources.map((source) =>
									readSourceNode(source, 1, reachableSources),
								),
							],
							obtainable:
								targetItemId === undefined
									? false
									: reachableItems.has(targetItemId),
						};
			reportProgress(onProgress, "finalizing", 100);
			return flow;
		}),
);

const readItemNode = (
	itemId: string,
	depth: number,
	items: ReadonlyMap<string, EditorItem>,
	starters: ReadonlyMap<string, ReadonlySet<EditorItemOriginItemNode["starterScopes"][number]>>,
	reachableItems: ReadonlySet<string>,
	cycleItemIds: ReadonlySet<string> = new Set(),
): EditorItemOriginItemNode => {
	const item = items.get(itemId);
	return {
		depth,
		id: `item:${itemId}`,
		itemId,
		kind: "item",
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

const readSourceNode = (
	source: OutputSource,
	depth: number,
	reachableSources: ReadonlySet<string>,
): EditorItemOriginSourceNode => ({
	depth,
	id: source.id,
	kind: "source",
	label: source.label,
	placement: source.placement,
	selectionKind: source.selectionKind,
	status: reachableSources.has(source.id) ? "reachable" : "blocked",
	sourceKind: source.kind,
	weightedSet: source.weightedSet,
});
