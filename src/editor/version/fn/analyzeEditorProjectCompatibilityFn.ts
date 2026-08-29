import {
	type EditorProjectCompatibility,
	type EditorProjectCompatibilityContext,
	type EditorProjectCompatibilityDiffResult,
	type EditorProjectCompatibilityPath,
	type EditorProjectCompatibilityRule,
} from "~/editor/version/EditorProjectCompatibility";
import type { EditorProjectSemanticDiff } from "~/editor/version/EditorProjectSemanticDiff";
import { readEditorProjectSemanticDiffsFn } from "~/editor/version/fn/readEditorProjectSemanticDiffsFn";
import { TypeSchema } from "~/engine/item/schema/TypeSchema";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

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
