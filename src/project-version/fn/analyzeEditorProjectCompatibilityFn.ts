import {
	type EditorProjectCompatibility,
	type EditorProjectCompatibilityContext,
	type EditorProjectCompatibilityDiffResult,
	type EditorProjectCompatibilityPath,
	type EditorProjectCompatibilityRule,
} from "~/project-version/type/EditorProjectCompatibility";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { TypeSchema } from "~/item-definition/schema/TypeSchema";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

type EditorProjectSemanticDiff =
	| {
			readonly after: unknown;
			readonly operation: "add";
			readonly path: EditorProjectCompatibilityPath;
	  }
	| {
			readonly before: unknown;
			readonly operation: "remove";
			readonly path: EditorProjectCompatibilityPath;
	  }
	| {
			readonly after: unknown;
			readonly before: unknown;
			readonly operation: "change";
			readonly path: EditorProjectCompatibilityPath;
	  };

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

const presentDiffValueFn = (value: unknown): PresentDiffValue => ({
	type: "present",
	value,
});

const isRecordFn = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const asRecordFn = (value: object): Record<string, unknown> =>
	Object.fromEntries(Object.entries(value));

const readObjectValueFn = (value: Record<string, unknown>, key: string): DiffValue =>
	Object.hasOwn(value, key) && value[key] !== undefined
		? presentDiffValueFn(value[key])
		: missingDiffValue;

const readSemanticValueFn = (value: DiffValue, path: EditorProjectCompatibilityPath): DiffValue => {
	if (value.type === "present") return value;
	if (path.length === 2 && path[0] === "meta" && path[1] === "toolbarSize")
		return presentDiffValueFn(0);
	if (
		path.length === 4 &&
		path[0] === "start" &&
		(path[1] === "board" || path[1] === "toolbar") &&
		typeof path[2] === "number" &&
		path[3] === "quantity"
	)
		return presentDiffValueFn(1);
	return value;
};

const createLeafDiffFn = (
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

const readValueDiffsFn = (
	before: DiffValue,
	after: DiffValue,
	path: EditorProjectCompatibilityPath,
): ReadonlyArray<EditorProjectSemanticDiff> => {
	before = readSemanticValueFn(before, path);
	after = readSemanticValueFn(after, path);
	if (before.type === "missing" || after.type === "missing")
		return createLeafDiffFn(before, after, path);
	if (isRecordFn(before.value) && isRecordFn(after.value))
		return readRecordDiffsFn(before.value, after.value, path);
	if (Array.isArray(before.value) && Array.isArray(after.value)) {
		const beforeArray = before.value;
		const afterArray = after.value;
		const length = Math.max(beforeArray.length, afterArray.length);
		return Array.from(
			{
				length,
			},
			(_unused, index) =>
				readValueDiffsFn(
					index < beforeArray.length
						? presentDiffValueFn(beforeArray[index])
						: missingDiffValue,
					index < afterArray.length
						? presentDiffValueFn(afterArray[index])
						: missingDiffValue,
					[
						...path,
						index,
					],
				),
		).flat();
	}
	return createLeafDiffFn(before, after, path);
};

const readRecordDiffsFn = (
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
			readValueDiffsFn(readObjectValueFn(before, key), readObjectValueFn(after, key), [
				...path,
				key,
			]),
		);

const readLinesFn = (item: ItemSchema.Type): ReadonlyArray<LineSchema.Type> => {
	if ("lines" in item) return item.lines ?? [];
	if ("line" in item)
		return [
			item.line,
		];
	return [];
};

const readLineDiffsFn = (
	itemId: string,
	before: ItemSchema.Type,
	after: ItemSchema.Type,
): ReadonlyArray<EditorProjectSemanticDiff> => {
	const beforeLines = readLinesFn(before);
	const afterLines = readLinesFn(after);
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
			return createLeafDiffFn(missingDiffValue, presentDiffValueFn(afterLine), path);
		if (afterLine === undefined)
			return createLeafDiffFn(presentDiffValueFn(beforeLine), missingDiffValue, path);
		return readRecordDiffsFn(asRecordFn(beforeLine), asRecordFn(afterLine), path);
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

const readItemDiffsFn = (
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
				return createLeafDiffFn(missingDiffValue, presentDiffValueFn(afterItem), path);
			if (afterItem === undefined)
				return createLeafDiffFn(presentDiffValueFn(beforeItem), missingDiffValue, path);
			const omittedLineKeys: ReadonlySet<string> = new Set([
				"line",
				"lines",
			]);
			return [
				...readRecordDiffsFn(
					asRecordFn(beforeItem),
					asRecordFn(afterItem),
					path,
					omittedLineKeys,
				),
				...readLineDiffsFn(itemId, beforeItem, afterItem),
			];
		});
};

/** Produces stable semantic config paths without classifying compatibility policy. */
const readEditorProjectSemanticDiffsFn = (
	before: GameConfigSchema.Type,
	after: GameConfigSchema.Type,
) => {
	const omittedItems: ReadonlySet<string> = new Set([
		"items",
	]);
	const diffs: ReadonlyArray<EditorProjectSemanticDiff> = [
		...readRecordDiffsFn(asRecordFn(before), asRecordFn(after), [], omittedItems),
		...readItemDiffsFn(before.items, after.items),
	];
	return diffs;
};

interface CompatibilityDecision {
	readonly message: string;
	readonly result: EditorProjectCompatibilityDiffResult;
	readonly rule: EditorProjectCompatibilityRule;
}

const AnyStringPathSegment: unique symbol = Symbol("AnyStringPathSegment");
type PathPatternSegment = string | number | typeof AnyStringPathSegment;

interface MinorPathRule {
	readonly message: string;
	readonly path: ReadonlyArray<PathPatternSegment>;
	readonly rule: EditorProjectCompatibilityRule;
}

const minorPathRules: ReadonlyArray<MinorPathRule> = [
	{
		message: "Game title changes are explicitly minor-compatible.",
		path: [
			"meta",
			"title",
		],
		rule: "game-title",
	},
	{
		message: "Item title changes are explicitly minor-compatible.",
		path: [
			"items",
			AnyStringPathSegment,
			"title",
		],
		rule: "item-title",
	},
	{
		message: "Item description changes are explicitly minor-compatible.",
		path: [
			"items",
			AnyStringPathSegment,
			"description",
		],
		rule: "item-description",
	},
	{
		message: "Line title changes are explicitly minor-compatible.",
		path: [
			"items",
			AnyStringPathSegment,
			"lines",
			AnyStringPathSegment,
			"title",
		],
		rule: "line-title",
	},
	{
		message: "Line description changes are explicitly minor-compatible.",
		path: [
			"items",
			AnyStringPathSegment,
			"lines",
			AnyStringPathSegment,
			"description",
		],
		rule: "line-description",
	},
	{
		message: "Line runtime changes preserve captured active-job timing.",
		path: [
			"items",
			AnyStringPathSegment,
			"lines",
			AnyStringPathSegment,
			"runtimeMs",
		],
		rule: "line-runtime",
	},
];

const matchesPath = (
	path: EditorProjectCompatibilityPath,
	pattern: ReadonlyArray<PathPatternSegment>,
) =>
	path.length === pattern.length &&
	path.every((segment, index) => {
		const expected = pattern[index];
		return expected === AnyStringPathSegment
			? typeof segment === "string"
			: segment === expected;
	});

const readChangedValues = (
	diff: EditorProjectSemanticDiff,
): {
	readonly after: unknown;
	readonly before: unknown;
} => ({
	after: diff.operation === "remove" ? undefined : diff.after,
	before: diff.operation === "add" ? undefined : diff.before,
});

const readSurfaceDecision = (
	diff: EditorProjectSemanticDiff,
): CompatibilityDecision | undefined => {
	const surfacePaths: ReadonlyArray<ReadonlyArray<PathPatternSegment>> = [
		[
			"meta",
			"board",
			"width",
		],
		[
			"meta",
			"board",
			"height",
		],
		[
			"meta",
			"inventory",
			"width",
		],
		[
			"meta",
			"inventory",
			"height",
		],
		[
			"meta",
			"toolbarSize",
		],
	];
	if (!surfacePaths.some((path) => matchesPath(diff.path, path))) return undefined;
	const { before, after } = readChangedValues(diff);
	const beforeSize = typeof before === "number" ? before : 0;
	const afterSize = typeof after === "number" ? after : 0;
	return afterSize >= beforeSize
		? {
				message: `Surface capacity grew from ${beforeSize} to ${afterSize}.`,
				result: "minor",
				rule: "surface-grown",
			}
		: {
				message: `Surface capacity shrank from ${beforeSize} to ${afterSize}.`,
				result: "major",
				rule: "surface-shrunk",
			};
};

const readTemporaryDurationDecision = (
	diff: EditorProjectSemanticDiff,
	previous: GameConfigSchema.Type,
	next: GameConfigSchema.Type,
): CompatibilityDecision | undefined => {
	if (
		diff.path.length !== 3 ||
		diff.path[0] !== "items" ||
		typeof diff.path[1] !== "string" ||
		diff.path[2] !== "durationMs"
	)
		return undefined;
	const itemId = diff.path[1];
	if (
		previous.items[itemId]?.type !== TypeSchema.enum.Temporary ||
		next.items[itemId]?.type !== TypeSchema.enum.Temporary
	)
		return undefined;
	return {
		message: "Temporary duration changes preserve the remaining lifetime of existing items.",
		result: "minor",
		rule: "temporary-duration",
	};
};

const classifyDiff = (
	diff: EditorProjectSemanticDiff,
	previous: GameConfigSchema.Type,
	next: GameConfigSchema.Type,
): CompatibilityDecision => {
	const pathRule = minorPathRules.find((rule) => matchesPath(diff.path, rule.path));
	if (pathRule !== undefined)
		return {
			message: pathRule.message,
			result: "minor",
			rule: pathRule.rule,
		};
	return (
		readTemporaryDurationDecision(diff, previous, next) ??
		readSurfaceDecision(diff) ?? {
			message: "No explicit minor compatibility rule admits this change.",
			result: "major",
			rule: "unclassified-change",
		}
	);
};

const attachDecision = (
	diff: EditorProjectSemanticDiff,
	decision: CompatibilityDecision,
): EditorProjectCompatibilityContext => {
	const base = {
		message: decision.message,
		path: diff.path,
		result: decision.result,
		rule: decision.rule,
	};
	if (diff.operation === "add")
		return {
			...base,
			after: diff.after,
			operation: diff.operation,
		};
	if (diff.operation === "remove")
		return {
			...base,
			before: diff.before,
			operation: diff.operation,
		};
	return {
		...base,
		after: diff.after,
		before: diff.before,
		operation: diff.operation,
	};
};

/** Classifies every semantic config diff and exposes the exact UI-ready decision context. */
export const analyzeEditorProjectCompatibilityFn = (
	previous: GameConfigSchema.Type,
	next: GameConfigSchema.Type,
) => {
	const diffs = readEditorProjectSemanticDiffsFn(previous, next);
	const context = diffs.map((diff) => attachDecision(diff, classifyDiff(diff, previous, next)));
	const compatibility: EditorProjectCompatibility = {
		context,
		result:
			context.length === 0
				? "noop"
				: context.some(({ result }) => result === "major")
					? "major"
					: "minor",
	};
	return compatibility;
};
