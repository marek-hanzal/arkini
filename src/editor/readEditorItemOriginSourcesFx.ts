import { Effect } from "effect";

import type {
	EditorItemOriginInputOccurrence,
	EditorItemOriginOutputKind,
	EditorItemOriginOutputOccurrence,
	EditorItemOriginSource,
} from "~/editor/EditorItemOriginSource";
import type { InputSchema } from "~/engine/input/schema/InputSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { LineSchema } from "~/engine/line/schema/LineSchema";
import type { OutputSchema } from "~/engine/output/schema/OutputSchema";

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
				runtimeMs: line.runtimeMs,
			},
		];
	});

const projectEditorItemOriginSources = (item: ItemSchema.Type): EditorItemOriginSource[] => {
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
				runtimeMs: item.durationMs,
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

/** Reads every concrete acquisition relationship authored by one item definition. */
export const readEditorItemOriginSourcesFx = Effect.fn("readEditorItemOriginSourcesFx")(
	(item: ItemSchema.Type) => Effect.sync(() => projectEditorItemOriginSources(item)),
);
