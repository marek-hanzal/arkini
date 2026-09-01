import {
	type ProjectCompatibility,
	type ProjectCompatibilityContext,
	type ProjectCompatibilityDiffResult,
	type ProjectCompatibilityPath,
	type ProjectCompatibilityRule,
} from "~/project-version/type/ProjectCompatibility";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { TypeSchema } from "~/item-definition/schema/TypeSchema";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

type ProjectSemanticDiff =
	| {
			readonly after: unknown;
			readonly operation: "add";
			readonly path: ProjectCompatibilityPath;
	  }
	| {
			readonly before: unknown;
			readonly operation: "remove";
			readonly path: ProjectCompatibilityPath;
	  }
	| {
			readonly after: unknown;
			readonly before: unknown;
			readonly operation: "change";
			readonly path: ProjectCompatibilityPath;
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

const readSemanticValueFn = (value: DiffValue, path: ProjectCompatibilityPath): DiffValue => {
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
	path: ProjectCompatibilityPath,
): ReadonlyArray<ProjectSemanticDiff> => {
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
	path: ProjectCompatibilityPath,
): ReadonlyArray<ProjectSemanticDiff> => {
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
	path: ProjectCompatibilityPath,
	omittedKeys: ReadonlySet<string> = new Set(),
): ReadonlyArray<ProjectSemanticDiff> =>
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
): ReadonlyArray<ProjectSemanticDiff> => {
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
		const path: ProjectCompatibilityPath = [
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
): ReadonlyArray<ProjectSemanticDiff> => {
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
			const path: ProjectCompatibilityPath = [
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
const readProjectSemanticDiffsFn = (
	before: GameConfigSchema.Type,
	after: GameConfigSchema.Type,
) => {
	const omittedItems: ReadonlySet<string> = new Set([
		"items",
	]);
	const diffs: ReadonlyArray<ProjectSemanticDiff> = [
		...readRecordDiffsFn(asRecordFn(before), asRecordFn(after), [], omittedItems),
		...readItemDiffsFn(before.items, after.items),
	];
	return diffs;
};

interface CompatibilityDecision {
	readonly message: string;
	readonly result: ProjectCompatibilityDiffResult;
	readonly rule: ProjectCompatibilityRule;
}

const AnyStringPathSegment: unique symbol = Symbol("AnyStringPathSegment");
const AnyNumberPathSegment: unique symbol = Symbol("AnyNumberPathSegment");
type PathPatternSegment =
	| string
	| number
	| typeof AnyNumberPathSegment
	| typeof AnyStringPathSegment;

interface MinorPathRule {
	readonly message: string;
	readonly path: ReadonlyArray<PathPatternSegment>;
	readonly rule: ProjectCompatibilityRule;
}

const minorPathRules: ReadonlyArray<MinorPathRule> = [
	...(
		[
			"avatar-01",
			"avatar-02",
			"avatar-03",
			"avatar-04",
			"avatar-05",
			"avatar-06",
			"avatar-07",
		] as const
	).map(
		(avatarRole): MinorPathRule => ({
			message: "About avatar asset changes are explicitly minor-compatible.",
			path: [
				"resources",
				avatarRole,
			],
			rule: "about-avatar",
		}),
	),
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
		message: "Default item artwork changes are explicitly minor-compatible.",
		path: [
			"items",
			AnyStringPathSegment,
			"asset",
			"default",
			AnyNumberPathSegment,
		],
		rule: "item-default-artwork",
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

const matchesPathFn = (
	path: ProjectCompatibilityPath,
	pattern: ReadonlyArray<PathPatternSegment>,
) =>
	path.length === pattern.length &&
	path.every((segment, index) => {
		const expected = pattern[index];
		if (expected === AnyStringPathSegment) return typeof segment === "string";
		if (expected === AnyNumberPathSegment) return typeof segment === "number";
		return segment === expected;
	});

const readChangedValuesFn = (
	diff: ProjectSemanticDiff,
): {
	readonly after: unknown;
	readonly before: unknown;
} => ({
	after: diff.operation === "remove" ? undefined : diff.after,
	before: diff.operation === "add" ? undefined : diff.before,
});

const readSurfaceDecisionFn = (diff: ProjectSemanticDiff): CompatibilityDecision | undefined => {
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
	if (!surfacePaths.some((path) => matchesPathFn(diff.path, path))) return undefined;
	const { before, after } = readChangedValuesFn(diff);
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

const readTemporaryDurationDecisionFn = (
	diff: ProjectSemanticDiff,
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

const classifyDiffFn = (
	diff: ProjectSemanticDiff,
	previous: GameConfigSchema.Type,
	next: GameConfigSchema.Type,
): CompatibilityDecision => {
	const pathRule = minorPathRules.find((rule) => matchesPathFn(diff.path, rule.path));
	if (pathRule !== undefined)
		return {
			message: pathRule.message,
			result: "minor",
			rule: pathRule.rule,
		};
	return (
		readTemporaryDurationDecisionFn(diff, previous, next) ??
		readSurfaceDecisionFn(diff) ?? {
			message: "No explicit minor compatibility rule admits this change.",
			result: "major",
			rule: "unclassified-change",
		}
	);
};

const attachDecisionFn = (
	diff: ProjectSemanticDiff,
	decision: CompatibilityDecision,
): ProjectCompatibilityContext => {
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
export const analyzeProjectCompatibilityFn = (
	previous: GameConfigSchema.Type,
	next: GameConfigSchema.Type,
) => {
	const diffs = readProjectSemanticDiffsFn(previous, next);
	const context = diffs.map((diff) =>
		attachDecisionFn(diff, classifyDiffFn(diff, previous, next)),
	);
	const compatibility: ProjectCompatibility = {
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
