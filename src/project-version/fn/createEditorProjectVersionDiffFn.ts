import type {
	EditorProjectVersionBinaryDiff,
	EditorProjectVersionDiff,
	EditorProjectVersionItemDiff,
	EditorProjectVersionReference,
	EditorProjectVersionValueChange,
} from "~/project-version/type/EditorProjectVersion";
import type {
	EditorProjectCompatibilityContext,
	EditorProjectCompatibilityDiffResult,
} from "~/project-version/type/EditorProjectCompatibility";
import { analyzeEditorProjectCompatibilityFn } from "~/project-version/fn/analyzeEditorProjectCompatibilityFn";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

interface EditorProjectVersionDiffSnapshot {
	readonly config: GameConfigSchema.Type;
	readonly arkpackVersion: string;
	readonly resources: ReadonlyMap<string, string>;
	readonly scenarios: ReadonlyMap<string, string>;
}

const materializeContextFn = (
	context: EditorProjectCompatibilityContext,
	path: string,
): EditorProjectVersionValueChange => {
	const base = {
		bump: context.result,
		path,
	};
	if (context.operation === "add")
		return {
			...base,
			after: context.after,
		};
	if (context.operation === "remove")
		return {
			...base,
			before: context.before,
		};
	return {
		...base,
		after: context.after,
		before: context.before,
	};
};

const readContextItemUidFn = (
	before: GameConfigSchema.Type["items"],
	after: GameConfigSchema.Type["items"],
	context: EditorProjectCompatibilityContext,
	itemId: string,
) => {
	if (context.operation === "remove") return before[itemId]?.uid ?? itemId;
	if (context.operation === "add") return after[itemId]?.uid ?? itemId;
	return after[itemId]?.uid ?? before[itemId]?.uid ?? itemId;
};

const readItemDiffsFn = (
	before: GameConfigSchema.Type["items"],
	after: GameConfigSchema.Type["items"],
	contexts: ReadonlyArray<EditorProjectCompatibilityContext>,
): ReadonlyArray<EditorProjectVersionItemDiff> => {
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
	const changesByUid = new Map<string, Array<EditorProjectVersionValueChange>>();
	for (const context of contexts) {
		if (context.path[0] !== "items" || typeof context.path[1] !== "string") continue;
		const itemId = context.path[1];
		const uid = readContextItemUidFn(before, after, context, itemId);
		const values = changesByUid.get(uid) ?? [];
		values.push(materializeContextFn(context, context.path.slice(2).join(".")));
		changesByUid.set(uid, values);
	}
	return Array.from(changesByUid, ([uid, values]) => ({
		change:
			beforeByUid.has(uid) && afterByUid.has(uid)
				? "changed"
				: beforeByUid.has(uid)
					? "deleted"
					: "added",
		uid,
		values,
	}));
};

const readBinaryDiffsFn = (
	before: ReadonlyMap<string, string>,
	after: ReadonlyMap<string, string>,
	bump?: EditorProjectCompatibilityDiffResult,
): ReadonlyArray<EditorProjectVersionBinaryDiff> =>
	Array.from(
		new Set([
			...before.keys(),
			...after.keys(),
		]),
	)
		.sort()
		.flatMap((id) => {
			const beforeHash = before.get(id);
			const afterHash = after.get(id);
			if (beforeHash === afterHash) return [];
			return [
				{
					change:
						beforeHash === undefined
							? ("added" as const)
							: afterHash === undefined
								? ("deleted" as const)
								: ("changed" as const),
					...(bump === undefined
						? {}
						: {
								bump,
							}),
					id,
				},
			];
		});

/** Projects the canonical Editor semantic diff into Versions and adds opaque sidecar changes. */
export const createEditorProjectVersionDiffFn = (
	from: EditorProjectVersionReference,
	to: EditorProjectVersionReference,
	before: EditorProjectVersionDiffSnapshot,
	after: EditorProjectVersionDiffSnapshot,
) => {
	const compatibility = analyzeEditorProjectCompatibilityFn(before.config, after.config);
	const project = [
		...(before.arkpackVersion === after.arkpackVersion
			? []
			: [
					{
						after: after.arkpackVersion,
						before: before.arkpackVersion,
						path: "arkpackVersion",
					},
				]),
		...compatibility.context
			.filter(({ path }) => path[0] !== "items")
			.map((context) =>
				materializeContextFn(
					context,
					[
						"config",
						...context.path,
					].join("."),
				),
			),
	];
	const items = readItemDiffsFn(before.config.items, after.config.items, compatibility.context);
	const resources = readBinaryDiffsFn(before.resources, after.resources, "minor");
	const scenarios = readBinaryDiffsFn(before.scenarios, after.scenarios);
	return {
		from,
		to,
		hasChanges:
			project.length > 0 || items.length > 0 || resources.length > 0 || scenarios.length > 0,
		project,
		items,
		resources,
		scenarios,
	} satisfies EditorProjectVersionDiff;
};
