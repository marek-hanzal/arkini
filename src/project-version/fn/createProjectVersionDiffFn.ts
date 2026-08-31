import type {
	ProjectVersionBinaryDiff,
	ProjectVersionDiff,
	ProjectVersionItemDiff,
	ProjectVersionReference,
	ProjectVersionValueChange,
} from "~/project-version/type/ProjectVersion";
import type {
	ProjectCompatibilityContext,
	ProjectCompatibilityDiffResult,
} from "~/project-version/type/ProjectCompatibility";
import { analyzeProjectCompatibilityFn } from "~/project-version/fn/analyzeProjectCompatibilityFn";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

interface ProjectVersionDiffSnapshot {
	readonly config: GameConfigSchema.Type;
	readonly arkpackVersion: string;
	readonly resources: ReadonlyMap<string, string>;
	readonly scenarios: ReadonlyMap<string, string>;
}

const materializeContextFn = (
	context: ProjectCompatibilityContext,
	path: string,
): ProjectVersionValueChange => {
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
	context: ProjectCompatibilityContext,
	itemId: string,
) => {
	if (context.operation === "remove") return before[itemId]?.uid ?? itemId;
	if (context.operation === "add") return after[itemId]?.uid ?? itemId;
	return after[itemId]?.uid ?? before[itemId]?.uid ?? itemId;
};

const readItemDiffsFn = (
	before: GameConfigSchema.Type["items"],
	after: GameConfigSchema.Type["items"],
	contexts: ReadonlyArray<ProjectCompatibilityContext>,
): ReadonlyArray<ProjectVersionItemDiff> => {
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
	const changesByUid = new Map<string, Array<ProjectVersionValueChange>>();
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
	bump?: ProjectCompatibilityDiffResult,
): ReadonlyArray<ProjectVersionBinaryDiff> =>
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
export const createProjectVersionDiffFn = (
	from: ProjectVersionReference,
	to: ProjectVersionReference,
	before: ProjectVersionDiffSnapshot,
	after: ProjectVersionDiffSnapshot,
) => {
	const compatibility = analyzeProjectCompatibilityFn(before.config, after.config);
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
	} satisfies ProjectVersionDiff;
};
