import { Effect } from "effect";

import type { EditorProjectCompatibilityPath } from "~/editor/version/EditorProjectCompatibility";
import type { EditorProjectSemanticDiff } from "~/editor/version/EditorProjectSemanticDiff";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { LineSchema } from "~/engine/line/schema/LineSchema";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

interface MissingDiffValue {
	readonly type: "missing";
}

interface PresentDiffValue {
	readonly type: "present";
	readonly value: unknown;
}

type DiffValue = MissingDiffValue | PresentDiffValue;

const missingDiffValue: MissingDiffValue = {
	type: "missing",
};

const presentDiffValue = (value: unknown): PresentDiffValue => ({
	type: "present",
	value,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const asRecord = (value: object): Record<string, unknown> =>
	Object.fromEntries(Object.entries(value));

const readObjectValue = (value: Record<string, unknown>, key: string): DiffValue =>
	Object.hasOwn(value, key) && value[key] !== undefined
		? presentDiffValue(value[key])
		: missingDiffValue;

const readSemanticValue = (value: DiffValue, path: EditorProjectCompatibilityPath): DiffValue => {
	if (value.type === "present") return value;
	if (path.length === 2 && path[0] === "meta" && path[1] === "toolbarSize")
		return presentDiffValue(0);
	if (
		path.length === 4 &&
		path[0] === "start" &&
		(path[1] === "board" || path[1] === "toolbar") &&
		typeof path[2] === "number" &&
		path[3] === "quantity"
	)
		return presentDiffValue(1);
	return value;
};

const createLeafDiff = (
	before: DiffValue,
	after: DiffValue,
	path: EditorProjectCompatibilityPath,
): ReadonlyArray<EditorProjectSemanticDiff> => {
	if (before.type === "missing" && after.type === "missing") return [];
	if (before.type === "missing" && after.type === "present")
		return [
			{
				after: after.value,
				operation: "add",
				path,
			},
		];
	if (before.type === "present" && after.type === "missing")
		return [
			{
				before: before.value,
				operation: "remove",
				path,
			},
		];
	if (before.type === "missing" || after.type === "missing") return [];
	if (Object.is(before.value, after.value)) return [];
	return [
		{
			after: after.value,
			before: before.value,
			operation: "change",
			path,
		},
	];
};

const readValueDiffs = (
	before: DiffValue,
	after: DiffValue,
	path: EditorProjectCompatibilityPath,
): ReadonlyArray<EditorProjectSemanticDiff> => {
	before = readSemanticValue(before, path);
	after = readSemanticValue(after, path);
	if (before.type === "missing" || after.type === "missing")
		return createLeafDiff(before, after, path);
	if (isRecord(before.value) && isRecord(after.value))
		return readRecordDiffs(before.value, after.value, path);
	if (Array.isArray(before.value) && Array.isArray(after.value)) {
		const beforeArray = before.value;
		const afterArray = after.value;
		const length = Math.max(beforeArray.length, afterArray.length);
		return Array.from(
			{
				length,
			},
			(_unused, index) =>
				readValueDiffs(
					index < beforeArray.length
						? presentDiffValue(beforeArray[index])
						: missingDiffValue,
					index < afterArray.length
						? presentDiffValue(afterArray[index])
						: missingDiffValue,
					[
						...path,
						index,
					],
				),
		).flat();
	}
	return createLeafDiff(before, after, path);
};

const readRecordDiffs = (
	before: Record<string, unknown>,
	after: Record<string, unknown>,
	path: EditorProjectCompatibilityPath,
	omittedKeys: ReadonlySet<string> = new Set(),
): ReadonlyArray<EditorProjectSemanticDiff> =>
	Array.from(
		new Set([
			...Object.keys(before),
			...Object.keys(after),
		]),
	)
		.filter((key) => !omittedKeys.has(key))
		.sort()
		.flatMap((key) =>
			readValueDiffs(readObjectValue(before, key), readObjectValue(after, key), [
				...path,
				key,
			]),
		);

const readLines = (item: ItemSchema.Type): ReadonlyArray<LineSchema.Type> => {
	if ("lines" in item) return item.lines ?? [];
	if ("line" in item)
		return [
			item.line,
		];
	return [];
};

const readLineDiffs = (
	itemId: string,
	before: ItemSchema.Type,
	after: ItemSchema.Type,
): ReadonlyArray<EditorProjectSemanticDiff> => {
	const beforeLines = readLines(before);
	const afterLines = readLines(after);
	const beforeById = new Map(
		beforeLines.map((line) => [
			line.id,
			line,
		]),
	);
	const afterById = new Map(
		afterLines.map((line) => [
			line.id,
			line,
		]),
	);
	const lineIds = Array.from(
		new Set([
			...beforeById.keys(),
			...afterById.keys(),
		]),
	).sort();
	const diffs = lineIds.flatMap((lineId) => {
		const beforeLine = beforeById.get(lineId);
		const afterLine = afterById.get(lineId);
		const path: EditorProjectCompatibilityPath = [
			"items",
			itemId,
			"lines",
			lineId,
		];
		if (beforeLine === undefined)
			return createLeafDiff(missingDiffValue, presentDiffValue(afterLine), path);
		if (afterLine === undefined)
			return createLeafDiff(presentDiffValue(beforeLine), missingDiffValue, path);
		return readRecordDiffs(asRecord(beforeLine), asRecord(afterLine), path);
	});
	const beforeOrder = beforeLines.map(({ id }) => id);
	const afterOrder = afterLines.map(({ id }) => id);
	const sameLineIds =
		beforeOrder.length === afterOrder.length &&
		beforeOrder.every((lineId) => afterById.has(lineId));
	const orderChanged =
		sameLineIds && beforeOrder.some((lineId, index) => afterOrder[index] !== lineId);
	return orderChanged
		? [
				...diffs,
				{
					after: afterOrder,
					before: beforeOrder,
					operation: "change",
					path: [
						"items",
						itemId,
						"lines",
					],
				},
			]
		: diffs;
};

const readItemDiffs = (
	before: GameConfigSchema.Type["items"],
	after: GameConfigSchema.Type["items"],
): ReadonlyArray<EditorProjectSemanticDiff> => {
	const beforeByUid = new Map(
		Object.values(before).map((item) => [
			item.uid,
			item,
		]),
	);
	const afterByUid = new Map(
		Object.values(after).map((item) => [
			item.uid,
			item,
		]),
	);
	return Array.from(
		new Set([
			...beforeByUid.keys(),
			...afterByUid.keys(),
		]),
	)
		.sort()
		.flatMap((uid) => {
			const beforeItem = beforeByUid.get(uid);
			const afterItem = afterByUid.get(uid);
			const itemId = afterItem?.id ?? beforeItem?.id;
			if (itemId === undefined) return [];
			const path: EditorProjectCompatibilityPath = [
				"items",
				itemId,
			];
			if (beforeItem === undefined)
				return createLeafDiff(missingDiffValue, presentDiffValue(afterItem), path);
			if (afterItem === undefined)
				return createLeafDiff(presentDiffValue(beforeItem), missingDiffValue, path);
			const omittedLineKeys: ReadonlySet<string> = new Set([
				"line",
				"lines",
			]);
			return [
				...readRecordDiffs(
					asRecord(beforeItem),
					asRecord(afterItem),
					path,
					omittedLineKeys,
				),
				...readLineDiffs(itemId, beforeItem, afterItem),
			];
		});
};

/** Produces stable semantic config paths without classifying compatibility policy. */
export const readEditorProjectSemanticDiffsFx = Effect.fn("readEditorProjectSemanticDiffsFx")(
	(before: GameConfigSchema.Type, after: GameConfigSchema.Type) =>
		Effect.sync(() => {
			const omittedItems: ReadonlySet<string> = new Set([
				"items",
			]);
			const diffs: ReadonlyArray<EditorProjectSemanticDiff> = [
				...readRecordDiffs(asRecord(before), asRecord(after), [], omittedItems),
				...readItemDiffs(before.items, after.items),
			];
			return diffs;
		}),
);
