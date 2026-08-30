import { Effect, Order } from "effect";

import {
	EditorItemOriginItemInputPortId,
	EditorItemOriginItemOutputPortId,
	type EditorItemOriginEdge,
	type EditorItemOriginFlow,
	type EditorItemOriginFlowProgress,
	type EditorItemOriginItemNode,
	type EditorItemOriginOperation,
	type EditorItemOriginOperationRequirementContext,
} from "~/flow/type/EditorItemOriginFlow";
import type { EditorItemOriginSource } from "~/flow/type/EditorItemOriginSource";
import { createEditorAcquisitionGraphFn } from "~/flow/fn/createEditorAcquisitionGraphFn";
import { readEditorItemOriginRelationsFn } from "~/flow/fn/readEditorItemOriginRelationsFn";
import { readEditorItemOriginSourcesFn } from "~/flow/fn/readEditorItemOriginSourcesFn";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

type EditorItemOriginFlowPhase = "indexing" | "resolving" | "finalizing";

const ProgressLabels: Record<EditorItemOriginFlowPhase, string> = {
	indexing: "Indexing sources",
	resolving: "Resolving reachability",
	finalizing: "Preparing flow",
};

/** Reports one normalized phase boundary for editor origin-flow construction. */
const reportEditorItemOriginFlowProgressFx = Effect.fn("reportEditorItemOriginFlowProgressFx")(
	(
		onProgress: ((progress: EditorItemOriginFlowProgress) => void) | undefined,
		phase: EditorItemOriginFlowPhase,
		percent: number,
	) =>
		Effect.sync(() =>
			onProgress?.({
				label: ProgressLabels[phase],
				percent: Math.max(0, Math.min(100, Math.round(percent))),
			}),
		),
);

/** Cooperatively returns editor flow construction to the renderer and remains interruptible. */
const yieldEditorItemOriginFlowFx = Effect.fn("yieldEditorItemOriginFlowFx")(() =>
	Effect.promise(async (signal) => {
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
	}),
);

const unique = <Value>(values: ReadonlyArray<Value>): Value[] => [
	...new Set(values),
];

interface EditorItemOriginSourceIndex {
	readonly items: ReadonlyMap<string, ItemSchema.Type>;
	readonly sources: ReadonlyArray<EditorItemOriginSource>;
	readonly sourcesById: ReadonlyMap<string, EditorItemOriginSource>;
	readonly sourcesByOutput: ReadonlyMap<string, ReadonlyArray<EditorItemOriginSource>>;
	readonly sourcesByOwner: ReadonlyMap<string, ReadonlyArray<EditorItemOriginSource>>;
	readonly starters: ReadonlyMap<
		string,
		ReadonlySet<EditorItemOriginItemNode["starterScopes"][number]>
	>;
}

/** Indexes authored items, starting scopes, and every concrete acquisition source. */
const indexEditorItemOriginSourcesFx = Effect.fn("indexEditorItemOriginSourcesFx")(function* ({
	config,
	onProgress,
}: {
	readonly config: GameConfigSchema.Type;
	readonly onProgress?: (progress: EditorItemOriginFlowProgress) => void;
}) {
	yield* reportEditorItemOriginFlowProgressFx(onProgress, "indexing", 0);
	yield* yieldEditorItemOriginFlowFx();
	const items = new Map(
		Object.values(config.items).map((item) => [
			item.id,
			item,
		]),
	);
	const starters = new Map<string, Set<EditorItemOriginItemNode["starterScopes"][number]>>();
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

	const graph = createEditorAcquisitionGraphFn(config);
	const sources = readEditorItemOriginSourcesFn(graph);
	yield* reportEditorItemOriginFlowProgressFx(onProgress, "indexing", 28);
	yield* yieldEditorItemOriginFlowFx();
	const sourcesByOutput = new Map<string, EditorItemOriginSource[]>();
	const sourcesByOwner = new Map<string, EditorItemOriginSource[]>();
	const sourcesById = new Map(
		sources.flatMap((source) =>
			[
				source.id,
				...source.routeIds,
			].map(
				(id) =>
					[
						id,
						source,
					] as const,
			),
		),
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
			yield* reportEditorItemOriginFlowProgressFx(
				onProgress,
				"indexing",
				28 + ((index + 1) / Math.max(1, sources.length)) * 12,
			);
			yield* yieldEditorItemOriginFlowFx();
		}
	}
	return {
		items,
		sources,
		sourcesById,
		sourcesByOutput,
		sourcesByOwner,
		starters,
	} satisfies EditorItemOriginSourceIndex;
});

const readOperationPortLabel = (itemId: string, items: EditorItemOriginSourceIndex["items"]) =>
	items.get(itemId)?.title || itemId;

const readRequirementContexts = (
	source: EditorItemOriginSource,
	itemId: string,
): ReadonlyArray<EditorItemOriginOperationRequirementContext> =>
	source.outputs.flatMap((output) => [
		...output.requirements.allOf
			.filter((requirement) => requirement.itemId === itemId)
			.map((requirement) => ({
				clause: "all-of" as const,
				outputRouteId: output.routeId,
				requirement,
			})),
		...output.requirements.anyOf.flatMap((clause, clauseIndex) =>
			clause
				.filter((requirement) => requirement.itemId === itemId)
				.map((requirement) => ({
					clause: "any-of" as const,
					clauseIndex,
					outputRouteId: output.routeId,
					requirement,
				})),
		),
		...(output.requirements.unsupported ?? [])
			.filter((requirement) => requirement.itemId === itemId)
			.map((requirement) => ({
				clause: "unsupported" as const,
				outputRouteId: output.routeId,
				requirement,
			})),
	]);

const readOperation = (
	source: EditorItemOriginSource,
	items: EditorItemOriginSourceIndex["items"],
): EditorItemOriginOperation => ({
	id: source.id,
	inputs: unique(source.requirementItemIds)
		.filter((itemId) => itemId !== source.ownerItemId)
		.sort((left, right) => Order.String(left, right))
		.map((itemId) => ({
			id: `${source.id}:input:${itemId}`,
			itemId,
			label: readOperationPortLabel(itemId, items),
			requirementContexts: readRequirementContexts(source, itemId),
		})),
	kind: source.kind,
	label: source.label,
	outputs: source.outputs.map((output, index) => ({
		id: `${source.id}:output:${index}:${output.itemId}`,
		itemId: output.itemId,
		label: readOperationPortLabel(output.itemId, items),
	})),
});

const readItemNode = (
	itemId: string,
	index: EditorItemOriginSourceIndex,
	acquisitionSourceByItem: ReadonlyMap<string, string>,
): EditorItemOriginItemNode => {
	const item = index.items.get(itemId);
	const operations = [
		...(index.sourcesByOwner.get(itemId) ?? []),
	]
		.sort((left, right) => Order.String(left.id, right.id))
		.map((source) => readOperation(source, index.items));
	return {
		acquisitionSourceId: acquisitionSourceByItem.get(itemId),
		id: `item:${itemId}`,
		itemId,
		operations,
		resourceIds: item?.asset.default ?? [
			"missing",
		],
		starterScopes: [
			...(index.starters.get(itemId) ?? []),
		],
		title: item?.title || itemId,
		type: item?.type ?? "missing",
	};
};

const readEdgesFn = (sources: ReadonlyArray<EditorItemOriginSource>): EditorItemOriginEdge[] => {
	const edges: EditorItemOriginEdge[] = [];
	for (const source of sources) {
		for (const relation of readEditorItemOriginRelationsFn(source)) {
			if (relation.role === "input") {
				const targetPortId = `${source.id}:input:${relation.fromItemId}`;
				edges.push({
					id: targetPortId,
					operationId: source.id,
					role: "input",
					requirementContexts: readRequirementContexts(source, relation.fromItemId),
					source: `item:${relation.fromItemId}`,
					sourcePortId: EditorItemOriginItemOutputPortId,
					target: `item:${relation.toItemId}`,
					targetPortId,
				});
				continue;
			}
			const outputIndex = relation.outputIndex;
			if (outputIndex === undefined) continue;
			const sourcePortId = `${source.id}:output:${outputIndex}:${relation.toItemId}`;
			edges.push({
				id: sourcePortId,
				operationId: source.id,
				role: "output",
				source: `item:${relation.fromItemId}`,
				sourcePortId,
				target: `item:${relation.toItemId}`,
				targetPortId: EditorItemOriginItemInputPortId,
			});
		}
	}
	return edges;
};

/** Materializes indexed acquisition truth into the editor's public node-and-edge contract. */
const materializeEditorItemOriginFlowFn = ({
	acquisitionSourceByItem,
	index,
}: {
	readonly acquisitionSourceByItem: ReadonlyMap<string, string>;
	readonly index: EditorItemOriginSourceIndex;
}): EditorItemOriginFlow => ({
	edges: readEdgesFn(index.sources),
	nodes: [
		...index.items.keys(),
	].map((itemId) => readItemNode(itemId, index, acquisitionSourceByItem)),
});

export interface EditorItemOriginFlowRequest {
	readonly config: GameConfigSchema.Type;
	readonly onProgress?: (progress: EditorItemOriginFlowProgress) => void;
}

const readAcquisitionSourceByItem = (index: EditorItemOriginSourceIndex) =>
	new Map(
		[
			...index.sourcesByOutput,
		].flatMap(([itemId, sources]) => {
			const source = [
				...sources,
			].sort((left, right) => left.id.localeCompare(right.id))[0];
			return source === undefined
				? []
				: [
						[
							itemId,
							source.id,
						] as const,
					];
		}),
	);

/** Builds the editor item graph cooperatively. Operations stay embedded in their owning item node. */
export const readEditorItemOriginFlowFx = Effect.fn("readEditorItemOriginFlowFx")(function* ({
	config,
	onProgress,
}: EditorItemOriginFlowRequest) {
	const index = yield* indexEditorItemOriginSourcesFx({
		config,
		onProgress,
	});
	yield* reportEditorItemOriginFlowProgressFx(onProgress, "resolving", 44);
	const acquisitionSourceByItem = readAcquisitionSourceByItem(index);
	yield* reportEditorItemOriginFlowProgressFx(onProgress, "resolving", 74);
	yield* yieldEditorItemOriginFlowFx();
	yield* reportEditorItemOriginFlowProgressFx(onProgress, "finalizing", 92);
	yield* yieldEditorItemOriginFlowFx();
	const flow = materializeEditorItemOriginFlowFn({
		acquisitionSourceByItem,
		index,
	});
	yield* reportEditorItemOriginFlowProgressFx(onProgress, "finalizing", 100);
	return flow;
});
