import { Effect, Order } from "effect";

import {
	ItemOriginItemInputPortId,
	ItemOriginItemOutputPortId,
	type ItemOriginEdge,
	type ItemOriginFlow,
	type ItemOriginFlowProgress,
	type ItemOriginItemNode,
	type ItemOriginOperation,
	type ItemOriginOperationRequirementContext,
} from "~/flow/type/ItemOriginFlow";
import type { ItemOriginSource } from "~/flow/type/ItemOriginSource";
import { createAcquisitionGraphFn } from "~/flow/fn/createAcquisitionGraphFn";
import { readItemOriginRelationsFn } from "~/flow/fn/readItemOriginRelationsFn";
import { readItemOriginSourcesFn } from "~/flow/fn/readItemOriginSourcesFn";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

type ItemOriginFlowPhase = "indexing" | "resolving" | "finalizing";

const ProgressLabels: Record<ItemOriginFlowPhase, string> = {
	indexing: "Indexing sources",
	resolving: "Resolving reachability",
	finalizing: "Preparing flow",
};

/** Reports one normalized phase boundary for origin-flow construction. */
const reportItemOriginFlowProgressFx = Effect.fn("reportEditorItemOriginFlowProgressFx")(
	(
		onProgressFn: ((progress: ItemOriginFlowProgress) => void) | undefined,
		phase: ItemOriginFlowPhase,
		percent: number,
	) =>
		Effect.sync(() =>
			onProgressFn?.({
				label: ProgressLabels[phase],
				percent: Math.max(0, Math.min(100, Math.round(percent))),
			}),
		),
);

/** Cooperatively returns flow construction to the renderer and remains interruptible. */
const yieldItemOriginFlowFx = Effect.fn("yieldEditorItemOriginFlowFx")(() =>
	Effect.promise(async (signal) => {
		const abortCauseFn = () =>
			signal.reason ?? new Error("Acquisition graph build interrupted.");
		if (signal.aborted) throw abortCauseFn();
		let interruptFn: (() => void) | undefined;
		const interruption = new Promise<never>((_Fn, rejectFn) => {
			interruptFn = () => rejectFn(abortCauseFn());
			signal.addEventListener("abort", interruptFn, {
				once: true,
			});
		});
		const continuation =
			typeof globalThis.scheduler === "undefined"
				? new Promise<void>((resolveFn) => setTimeout(resolveFn, 0))
				: globalThis.scheduler.postTask(() => undefined, {
						priority: "background",
					});
		try {
			await Promise.race([
				continuation,
				interruption,
			]);
			if (signal.aborted) throw abortCauseFn();
		} finally {
			if (interruptFn !== undefined) signal.removeEventListener("abort", interruptFn);
		}
	}),
);

const uniqueFn = <Value>(values: ReadonlyArray<Value>): Value[] => [
	...new Set(values),
];

interface ItemOriginSourceIndex {
	readonly items: ReadonlyMap<string, ItemSchema.Type>;
	readonly sources: ReadonlyArray<ItemOriginSource>;
	readonly sourcesById: ReadonlyMap<string, ItemOriginSource>;
	readonly sourcesByOutput: ReadonlyMap<string, ReadonlyArray<ItemOriginSource>>;
	readonly sourcesByOwner: ReadonlyMap<string, ReadonlyArray<ItemOriginSource>>;
	readonly starters: ReadonlyMap<
		string,
		ReadonlySet<ItemOriginItemNode["starterScopes"][number]>
	>;
}

/** Indexes authored items, starting scopes, and every concrete acquisition source. */
const indexItemOriginSourcesFx = Effect.fn("indexEditorItemOriginSourcesFx")(function* ({
	config,
	onProgressFn,
}: {
	readonly config: GameConfigSchema.Type;
	readonly onProgressFn?: (progress: ItemOriginFlowProgress) => void;
}) {
	yield* reportItemOriginFlowProgressFx(onProgressFn, "indexing", 0);
	yield* yieldItemOriginFlowFx();
	const items = new Map(
		Object.values(config.items).map((item) => [
			item.id,
			item,
		]),
	);
	const starters = new Map<string, Set<ItemOriginItemNode["starterScopes"][number]>>();
	const addStarterFn = (itemId: string, scope: ItemOriginItemNode["starterScopes"][number]) => {
		const scopes = starters.get(itemId) ?? new Set();
		scopes.add(scope);
		starters.set(itemId, scopes);
	};
	for (const entry of config.start.board) addStarterFn(entry.itemId, "Board");
	for (const entry of config.start.inventory) addStarterFn(entry.itemId, "Inventory");
	for (const entry of config.start.toolbar) addStarterFn(entry.itemId, "Toolbar");

	const graph = createAcquisitionGraphFn(config);
	const sources = readItemOriginSourcesFn(graph);
	yield* reportItemOriginFlowProgressFx(onProgressFn, "indexing", 28);
	yield* yieldItemOriginFlowFx();
	const sourcesByOutput = new Map<string, ItemOriginSource[]>();
	const sourcesByOwner = new Map<string, ItemOriginSource[]>();
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
		for (const outputItemId of uniqueFn(source.outputs.map(({ itemId }) => itemId))) {
			const matches = sourcesByOutput.get(outputItemId) ?? [];
			matches.push(source);
			sourcesByOutput.set(outputItemId, matches);
		}
		if ((index + 1) % 64 === 0) {
			yield* reportItemOriginFlowProgressFx(
				onProgressFn,
				"indexing",
				28 + ((index + 1) / Math.max(1, sources.length)) * 12,
			);
			yield* yieldItemOriginFlowFx();
		}
	}
	return {
		items,
		sources,
		sourcesById,
		sourcesByOutput,
		sourcesByOwner,
		starters,
	} satisfies ItemOriginSourceIndex;
});

const readOperationPortLabelFn = (itemId: string, items: ItemOriginSourceIndex["items"]) =>
	items.get(itemId)?.title || itemId;

const readRequirementContextsFn = (
	source: ItemOriginSource,
	itemId: string,
): ReadonlyArray<ItemOriginOperationRequirementContext> =>
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

const readOperationFn = (
	source: ItemOriginSource,
	items: ItemOriginSourceIndex["items"],
): ItemOriginOperation => ({
	id: source.id,
	inputs: uniqueFn(source.requirementItemIds)
		.filter((itemId) => itemId !== source.ownerItemId)
		.sort((left, right) => Order.String(left, right))
		.map((itemId) => ({
			id: `${source.id}:input:${itemId}`,
			itemId,
			label: readOperationPortLabelFn(itemId, items),
			requirementContexts: readRequirementContextsFn(source, itemId),
		})),
	kind: source.kind,
	label: source.label,
	outputs: source.outputs.map((output, index) => ({
		id: `${source.id}:output:${index}:${output.itemId}`,
		itemId: output.itemId,
		label: readOperationPortLabelFn(output.itemId, items),
	})),
});

const readItemNodeFn = (
	itemId: string,
	index: ItemOriginSourceIndex,
	acquisitionSourceByItem: ReadonlyMap<string, string>,
): ItemOriginItemNode => {
	const item = index.items.get(itemId);
	const operations = [
		...(index.sourcesByOwner.get(itemId) ?? []),
	]
		.sort((left, right) => Order.String(left.id, right.id))
		.map((source) => readOperationFn(source, index.items));
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

const readEdgesFn = (sources: ReadonlyArray<ItemOriginSource>): ItemOriginEdge[] => {
	const edges: ItemOriginEdge[] = [];
	for (const source of sources) {
		for (const relation of readItemOriginRelationsFn(source)) {
			if (relation.role === "input") {
				const targetPortId = `${source.id}:input:${relation.fromItemId}`;
				edges.push({
					id: targetPortId,
					operationId: source.id,
					role: "input",
					requirementContexts: readRequirementContextsFn(source, relation.fromItemId),
					source: `item:${relation.fromItemId}`,
					sourcePortId: ItemOriginItemOutputPortId,
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
				targetPortId: ItemOriginItemInputPortId,
			});
		}
	}
	return edges;
};

/** Materializes indexed acquisition truth into the public node-and-edge contract. */
const materializeItemOriginFlowFn = ({
	acquisitionSourceByItem,
	index,
}: {
	readonly acquisitionSourceByItem: ReadonlyMap<string, string>;
	readonly index: ItemOriginSourceIndex;
}): ItemOriginFlow => ({
	edges: readEdgesFn(index.sources),
	nodes: [
		...index.items.keys(),
	].map((itemId) => readItemNodeFn(itemId, index, acquisitionSourceByItem)),
});

export interface ItemOriginFlowRequest {
	readonly config: GameConfigSchema.Type;
	readonly onProgressFn?: (progress: ItemOriginFlowProgress) => void;
}

const readAcquisitionSourceByItemFn = (index: ItemOriginSourceIndex) =>
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

/** Builds the item-origin graph cooperatively. Operations stay embedded in their owning item node. */
export const readItemOriginFlowFx = Effect.fn("readEditorItemOriginFlowFx")(function* ({
	config,
	onProgressFn,
}: ItemOriginFlowRequest) {
	const index = yield* indexItemOriginSourcesFx({
		config,
		onProgressFn,
	});
	yield* reportItemOriginFlowProgressFx(onProgressFn, "resolving", 44);
	const acquisitionSourceByItem = readAcquisitionSourceByItemFn(index);
	yield* reportItemOriginFlowProgressFx(onProgressFn, "resolving", 74);
	yield* yieldItemOriginFlowFx();
	yield* reportItemOriginFlowProgressFx(onProgressFn, "finalizing", 92);
	yield* yieldItemOriginFlowFx();
	const flow = materializeItemOriginFlowFn({
		acquisitionSourceByItem,
		index,
	});
	yield* reportItemOriginFlowProgressFx(onProgressFn, "finalizing", 100);
	return flow;
});
