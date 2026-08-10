import type {
	EditorInput,
	EditorItem,
	EditorLine,
	EditorOutput,
} from "~/bridge/item/editor/EditorItemModel";
import {
	type EditorItemOriginOutputOccurrence,
	type EditorItemOriginOutputKind,
	type EditorItemOriginSource,
} from "~/bridge/item/editor/EditorItemOriginSource";

const unique = <Value>(values: ReadonlyArray<Value>): Value[] => [
	...new Set(values),
];

const readOutputOccurrences = (
	output: EditorOutput | undefined,
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
				selectionKind,
				weightedSet,
			}));
		}),
	);
};

const dedupeOccurrences = (occurrences: ReadonlyArray<EditorItemOriginOutputOccurrence>) => {
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

const readLineSources = (
	item: EditorItem,
	lines: ReadonlyArray<EditorLine>,
): EditorItemOriginSource[] =>
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

/** Reads every concrete acquisition source authored by one item definition. */
const readEditorItemOriginSources = (item: EditorItem): EditorItemOriginSource[] => {
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
			kind: "charges",
			label: "Depletion",
			outputs: depletedOutputs,
			ownerItemId: item.id,
			requirementItemIds: [
				item.id,
			],
		});
	if (item.type === "temporary") {
		const expiryOutputs = dedupeOccurrences(readOutputOccurrences(item.output));
		if (expiryOutputs.length > 0)
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
	for (const [index, merge] of (item.merge ?? []).entries()) {
		const outputs = readOutputOccurrences(merge.output);
		if (merge.effect === "replace")
			outputs.push({
				itemId: merge.result,
				placement: undefined,
				selectionKind: "replace",
				weightedSet: false,
			});
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

/** Reads every concrete acquisition source authored by one item definition. */
export const readEditorItemOriginSourcesFx = Effect.fn("readEditorItemOriginSourcesFx")(
	(item: EditorItem) => Effect.sync(() => readEditorItemOriginSources(item)),
);
import { Effect } from "effect";
