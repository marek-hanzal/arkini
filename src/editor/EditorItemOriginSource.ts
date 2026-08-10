import type { InputSchema } from "~/engine/input/schema/InputSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { LineSchema } from "~/engine/line/schema/LineSchema";
import type { OutputSchema } from "~/engine/output/schema/OutputSchema";
import type { QuantitySchema } from "~/engine/quantity/schema/QuantitySchema";

export type EditorItemOriginOperationKind = "line" | "charges" | "merge" | "expiry";
export type EditorItemOriginOutputKind = "guaranteed" | "chance" | "weighted" | "replace";

export interface EditorItemOriginOutputOccurrence {
	readonly itemId: string;
	readonly placement: "drop" | "random" | undefined;
	readonly quantity: QuantitySchema.Type;
	readonly selectionKind: EditorItemOriginOutputKind;
	readonly weightedSet: boolean;
}

export interface EditorItemOriginInputOccurrence {
	readonly itemId: string;
	readonly quantity: QuantitySchema.Type;
}

export type EditorItemOriginSourceReference =
	| {
			readonly type: "line";
			readonly lineId: string;
	  }
	| {
			readonly type: "charges";
	  }
	| {
			readonly type: "expiry";
	  }
	| {
			readonly type: "merge";
			readonly ruleNumber: number;
	  };

export interface EditorItemOriginSource {
	readonly id: string;
	readonly inputs: ReadonlyArray<EditorItemOriginInputOccurrence>;
	readonly kind: EditorItemOriginOperationKind;
	readonly label: string;
	readonly outputs: ReadonlyArray<EditorItemOriginOutputOccurrence>;
	readonly ownerItemId: string;
	readonly reference: EditorItemOriginSourceReference;
	readonly requirementItemIds: ReadonlyArray<string>;
}

export type EditorItemOriginRelationRole = "input" | "output";

export interface EditorItemOriginRelation {
	readonly fromItemId: string;
	readonly outputIndex?: number;
	readonly role: EditorItemOriginRelationRole;
	readonly source: EditorItemOriginSource;
	readonly toItemId: string;
}

export interface EditorItemOriginRelationSubgraph {
	readonly itemIds: ReadonlySet<string>;
	readonly relations: ReadonlyArray<
		EditorItemOriginRelation & {
			readonly level: number;
		}
	>;
}

export interface EditorItemOriginIncomeSubgraph {
	readonly itemIds: ReadonlySet<string>;
	readonly sources: ReadonlyArray<EditorItemOriginSource>;
}

const unique = <Value>(values: ReadonlyArray<Value>): Value[] => [
	...new Set(values),
];

const readOutputOccurrences = (
	output: OutputSchema.Type | undefined,
): EditorItemOriginOutputOccurrence[] => {
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
				quantity: drop.quantity,
				selectionKind,
				weightedSet,
			}));
		}),
	);
};

const dedupeOccurrences = (occurrences: ReadonlyArray<EditorItemOriginOutputOccurrence>) => {
	const seen = new Set<string>();
	return occurrences.filter((occurrence) => {
		const key = `${occurrence.itemId}:${occurrence.quantity.min}:${occurrence.quantity.max}:${occurrence.selectionKind}:${occurrence.placement ?? "none"}:${occurrence.weightedSet}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
};

const readInputOccurrence = (
	input: InputSchema.Type,
): EditorItemOriginInputOccurrence | undefined => {
	switch (input.type) {
		case "simple":
			return undefined;
		case "materials":
			return {
				itemId: input.selector.itemId,
				quantity: input.quantity,
			};
		case "deposit":
			return {
				itemId: input.query.selector.itemId,
				quantity: {
					min: 1,
					max: 1,
				},
			};
	}
};

const readLineSources = (
	item: ItemSchema.Type,
	lines: ReadonlyArray<LineSchema.Type>,
): EditorItemOriginSource[] =>
	lines.flatMap((line, index) => {
		const outputs = dedupeOccurrences(readOutputOccurrences(line.output));
		if (outputs.length === 0) return [];
		const inputs = line.input
			.map(readInputOccurrence)
			.filter((input): input is EditorItemOriginInputOccurrence => input !== undefined);
		return [
			{
				id: `source:${item.id}:line:${line.id || index}`,
				inputs,
				kind: "line",
				label: line.title || "Production",
				outputs,
				ownerItemId: item.id,
				reference: {
					type: "line",
					lineId: line.id || `line #${index + 1}`,
				},
				requirementItemIds: unique([
					item.id,
					...inputs.map(({ itemId }) => itemId),
				]),
			},
		];
	});

/** Reads every concrete acquisition relationship authored by one item definition. */
export const readEditorItemOriginSources = (item: ItemSchema.Type): EditorItemOriginSource[] => {
	const sources: EditorItemOriginSource[] = [];
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
	if (depletedOutputs.length > 0)
		sources.push({
			id: `source:${item.id}:charges`,
			inputs: [],
			kind: "charges",
			label: "Depletion",
			outputs: depletedOutputs,
			ownerItemId: item.id,
			reference: {
				type: "charges",
			},
			requirementItemIds: [
				item.id,
			],
		});
	if (item.type === "temporary") {
		const expiryOutputs = dedupeOccurrences(readOutputOccurrences(item.output));
		if (expiryOutputs.length > 0)
			sources.push({
				id: `source:${item.id}:expiry`,
				inputs: [],
				kind: "expiry",
				label: "Expiry",
				outputs: expiryOutputs,
				ownerItemId: item.id,
				reference: {
					type: "expiry",
				},
				requirementItemIds: [
					item.id,
				],
			});
	}
	for (const [index, merge] of (item.merge ?? []).entries()) {
		const outputs = readOutputOccurrences(merge.output);
		if (merge.effect === "replace")
			outputs.push({
				itemId: merge.result,
				placement: undefined,
				quantity: {
					min: 1,
					max: 1,
				},
				selectionKind: "replace",
				weightedSet: false,
			});
		const deduped = dedupeOccurrences(outputs);
		if (deduped.length === 0) continue;
		sources.push({
			id: `source:${item.id}:merge:${index}`,
			inputs: [
				{
					itemId: merge.target.itemId,
					quantity: {
						min: 1,
						max: 1,
					},
				},
			],
			kind: "merge",
			label: "Merge",
			outputs: deduped,
			ownerItemId: item.id,
			reference: {
				type: "merge",
				ruleNumber: index + 1,
			},
			requirementItemIds: unique([
				item.id,
				merge.target.itemId,
			]),
		});
	}
	return sources;
};

/** Projects the exact item-to-item edges materialized by the editor origin flow. */
export const readEditorItemOriginRelations = (
	source: EditorItemOriginSource,
): EditorItemOriginRelation[] => [
	...unique(source.requirementItemIds)
		.filter((itemId) => itemId !== source.ownerItemId)
		.sort((left, right) => left.localeCompare(right))
		.map((itemId) => ({
			fromItemId: itemId,
			role: "input" as const,
			source,
			toItemId: source.ownerItemId,
		})),
	...source.outputs.map((output, outputIndex) => ({
		fromItemId: source.ownerItemId,
		outputIndex,
		role: "output" as const,
		source,
		toItemId: output.itemId,
	})),
];

/** Traverses canonical input edges forward and output edges backward, matching editor relation lookup. */
export const readEditorItemOriginRelationSubgraph = ({
	level,
	role,
	sources,
	targetItemId,
}: {
	readonly level: number;
	readonly role: EditorItemOriginRelationRole;
	readonly sources: ReadonlyArray<EditorItemOriginSource>;
	readonly targetItemId: string;
}): EditorItemOriginRelationSubgraph => {
	const relationsBySourceItem = new Map<string, EditorItemOriginRelation[]>();
	for (const relation of sources.flatMap(readEditorItemOriginRelations)) {
		if (relation.role !== role) continue;
		const traversalSourceItemId = role === "input" ? relation.fromItemId : relation.toItemId;
		const matches = relationsBySourceItem.get(traversalSourceItemId) ?? [];
		matches.push(relation);
		relationsBySourceItem.set(traversalSourceItemId, matches);
	}
	for (const relations of relationsBySourceItem.values())
		relations.sort(
			(left, right) =>
				left.source.id.localeCompare(right.source.id) ||
				left.toItemId.localeCompare(right.toItemId) ||
				(left.outputIndex ?? -1) - (right.outputIndex ?? -1),
		);

	const itemIds = new Set<string>([
		targetItemId,
	]);
	const relationByKey = new Map<
		string,
		EditorItemOriginRelation & {
			readonly level: number;
		}
	>();
	const reachedLevelByItem = new Map<string, number>([
		[
			targetItemId,
			0,
		],
	]);
	const pending: Array<{
		readonly itemId: string;
		readonly level: number;
	}> = [
		{
			itemId: targetItemId,
			level: 0,
		},
	];
	for (let index = 0; index < pending.length; index += 1) {
		const current = pending[index];
		if (current === undefined || current.level >= level) continue;
		const nextLevel = current.level + 1;
		for (const relation of relationsBySourceItem.get(current.itemId) ?? []) {
			const reachedItemId = role === "input" ? relation.toItemId : relation.fromItemId;
			const key = JSON.stringify([
				relation.role,
				relation.source.id,
				relation.fromItemId,
				relation.toItemId,
				relation.outputIndex ?? "input",
			]);
			const existing = relationByKey.get(key);
			if (existing === undefined || nextLevel < existing.level)
				relationByKey.set(key, {
					...relation,
					level: nextLevel,
				});
			itemIds.add(reachedItemId);
			const reachedLevel = reachedLevelByItem.get(reachedItemId);
			if (reachedLevel !== undefined && reachedLevel <= nextLevel) continue;
			reachedLevelByItem.set(reachedItemId, nextLevel);
			pending.push({
				itemId: reachedItemId,
				level: nextLevel,
			});
		}
	}
	return {
		itemIds,
		relations: [
			...relationByKey.values(),
		].sort(
			(left, right) =>
				left.level - right.level ||
				left.source.id.localeCompare(right.source.id) ||
				left.fromItemId.localeCompare(right.fromItemId) ||
				left.toItemId.localeCompare(right.toItemId) ||
				(left.outputIndex ?? -1) - (right.outputIndex ?? -1),
		),
	};
};

/** Resolves which deterministic acquisition source first makes each item reachable. */
export const resolveEditorItemOriginReachability = ({
	sources,
	starters,
}: {
	readonly sources: ReadonlyArray<EditorItemOriginSource>;
	readonly starters: ReadonlySet<string>;
}) => {
	const reachableItems = new Set<string>();
	const reachableSources = new Set<string>();
	const acquisitionSourceByItem = new Map<string, string>();
	const waitingSources = new Map<string, EditorItemOriginSource[]>();
	const remainingRequirements = new Map<string, number>();
	const pending: Array<{
		readonly itemId: string;
		readonly sourceId?: string;
	}> = [
		...[
			...starters,
		]
			.sort()
			.map((itemId) => ({
				itemId,
			})),
	];
	for (const source of sources) {
		const requirements = unique(source.requirementItemIds);
		remainingRequirements.set(source.id, requirements.length);
		for (const requirement of requirements) {
			const waiting = waitingSources.get(requirement) ?? [];
			waiting.push(source);
			waitingSources.set(requirement, waiting);
		}
	}
	for (let index = 0; index < pending.length; index += 1) {
		const candidate = pending[index];
		if (candidate === undefined || reachableItems.has(candidate.itemId)) continue;
		reachableItems.add(candidate.itemId);
		if (candidate.sourceId !== undefined)
			acquisitionSourceByItem.set(candidate.itemId, candidate.sourceId);
		for (const source of waitingSources.get(candidate.itemId) ?? []) {
			if (reachableSources.has(source.id)) continue;
			const remaining = (remainingRequirements.get(source.id) ?? 1) - 1;
			remainingRequirements.set(source.id, remaining);
			if (remaining !== 0) continue;
			reachableSources.add(source.id);
			pending.push(
				...unique(source.outputs.map(({ itemId }) => itemId)).map((itemId) => ({
					itemId,
					sourceId: source.id,
				})),
			);
		}
	}
	return acquisitionSourceByItem as ReadonlyMap<string, string>;
};

/** Traces the same one witnessed Income proof used by the item-specific UI flow. */
export const readEditorItemOriginIncomeSubgraph = ({
	acquisitionSourceByItem,
	sources,
	starters,
	targetItemId,
}: {
	readonly acquisitionSourceByItem: ReadonlyMap<string, string>;
	readonly sources: ReadonlyArray<EditorItemOriginSource>;
	readonly starters: ReadonlySet<string>;
	readonly targetItemId: string;
}): EditorItemOriginIncomeSubgraph => {
	const sourcesById = new Map(
		sources.map((source) => [
			source.id,
			source,
		]),
	);
	const sourcesByOutput = new Map<string, EditorItemOriginSource[]>();
	for (const source of sources)
		for (const outputItemId of unique(source.outputs.map(({ itemId }) => itemId))) {
			const matches = sourcesByOutput.get(outputItemId) ?? [];
			matches.push(source);
			sourcesByOutput.set(outputItemId, matches);
		}
	const itemIds = new Set<string>();
	const tracedItems = new Set<string>();
	const includedSources = new Map<string, EditorItemOriginSource>();
	const traceItem = (itemId: string) => {
		itemIds.add(itemId);
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
		for (const requirement of unique(source.requirementItemIds).sort()) traceItem(requirement);
	};
	traceItem(targetItemId);
	return {
		itemIds,
		sources: [
			...includedSources.values(),
		],
	};
};
