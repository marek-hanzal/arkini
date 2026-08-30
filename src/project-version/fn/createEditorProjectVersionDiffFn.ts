import type {
	EditorProjectVersionBinaryDiff,
	EditorProjectVersionDiff,
	EditorProjectVersionItemDiff,
	EditorProjectVersionReference,
	EditorProjectVersionValueChange,
} from "~/project-version/EditorProjectVersion";
import type {
	EditorProjectCompatibilityContext,
	EditorProjectCompatibilityDiffResult,
} from "~/project-version/EditorProjectCompatibility";
import { analyzeEditorProjectCompatibilityFn } from "~/project-version/fn/analyzeEditorProjectCompatibilityFn";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

export interface EditorProjectVersionDiffSnapshot {
	readonly config: GameConfigSchema.Type;
	readonly arkpackVersion: string;
	readonly resources: ReadonlyMap<string, string>;
	readonly scenarios: ReadonlyMap<string, string>;
}

const materializeContext = (
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

const readContextItemUid = (
	before: GameConfigSchema.Type["items"],
	after: GameConfigSchema.Type["items"],
	beforeByUid: ReadonlyMap<string, GameConfigSchema.Type["items"][string]>,
	afterByUid: ReadonlyMap<string, GameConfigSchema.Type["items"][string]>,
	context: EditorProjectCompatibilityContext,
	itemId: string,
) => {
	if (context.operation === "remove") {
		const uid = before[itemId]?.uid;
		if (uid === undefined)
			throw new Error(`Removed item ${itemId} is missing from the before snapshot.`);
		return uid;
	}
	if (context.operation === "add") {
		const uid = after[itemId]?.uid;
		if (uid === undefined)
			throw new Error(`Added item ${itemId} is missing from the after snapshot.`);
		return uid;
	}
	const uid = after[itemId]?.uid;
	if (uid === undefined)
		throw new Error(`Changed item ${itemId} is missing from the after snapshot.`);
	if (!beforeByUid.has(uid) || !afterByUid.has(uid))
		throw new Error(`Changed item ${itemId} does not preserve its UID.`);
	return uid;
};

const readItemDiffs = (
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
		const uid = readContextItemUid(before, after, beforeByUid, afterByUid, context, itemId);
		const values = changesByUid.get(uid) ?? [];
		values.push(materializeContext(context, context.path.slice(2).join(".")));
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

const readBinaryDiffs = (
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
				materializeContext(
					context,
					[
						"config",
						...context.path,
					].join("."),
				),
			),
	];
	const items = readItemDiffs(before.config.items, after.config.items, compatibility.context);
	const resources = readBinaryDiffs(before.resources, after.resources, "minor");
	const scenarios = readBinaryDiffs(before.scenarios, after.scenarios);
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
