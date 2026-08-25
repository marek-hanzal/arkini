import type {
	EditorProjectVersionBinaryDiff,
	EditorProjectVersionDiff,
	EditorProjectVersionItemDiff,
	EditorProjectVersionReference,
	EditorProjectVersionValueChange,
} from "~/editor/version/EditorProjectVersion";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

export interface EditorProjectVersionDiffSnapshot {
	readonly config: GameConfigSchema.Type;
	readonly arkpackVersion: string;
	readonly resources: ReadonlyMap<string, string>;
	readonly scenarios: ReadonlyMap<string, string>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isEqual = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

const readValueChanges = (
	before: unknown,
	after: unknown,
	path = "",
): ReadonlyArray<EditorProjectVersionValueChange> => {
	if (isEqual(before, after)) return [];
	if (isRecord(before) && isRecord(after)) {
		const keys = Array.from(
			new Set([
				...Object.keys(before),
				...Object.keys(after),
			]),
		).sort();
		return keys.flatMap((key) =>
			readValueChanges(before[key], after[key], path === "" ? key : `${path}.${key}`),
		);
	}
	return [
		{
			...(before === undefined
				? {}
				: {
						before,
					}),
			...(after === undefined
				? {}
				: {
						after,
					}),
			path,
		},
	];
};

const readItemDiffs = (
	before: GameConfigSchema.Type["items"],
	after: GameConfigSchema.Type["items"],
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
	return Array.from(
		new Set([
			...beforeByUid.keys(),
			...afterByUid.keys(),
		]),
	)
		.sort()
		.flatMap<EditorProjectVersionItemDiff>((uid) => {
			const beforeItem = beforeByUid.get(uid);
			const afterItem = afterByUid.get(uid);
			if (beforeItem === undefined && afterItem !== undefined)
				return [
					{
						change: "added" as const,
						uid,
						values: readValueChanges(undefined, afterItem),
					},
				];
			if (beforeItem !== undefined && afterItem === undefined)
				return [
					{
						change: "deleted" as const,
						uid,
						values: readValueChanges(beforeItem, undefined),
					},
				];
			const values = readValueChanges(beforeItem, afterItem);
			return values.length === 0
				? []
				: [
						{
							change: "changed" as const,
							uid,
							values,
						},
					];
		});
};

const readBinaryDiffs = (
	before: ReadonlyMap<string, string>,
	after: ReadonlyMap<string, string>,
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
					id,
				},
			];
		});

const withoutItems = ({ items: _items, ...config }: GameConfigSchema.Type) => config;

/** Produces the stable user-facing structural diff shared by Versions UI and MCP. */
export const createEditorProjectVersionDiff = (
	from: EditorProjectVersionReference,
	to: EditorProjectVersionReference,
	before: EditorProjectVersionDiffSnapshot,
	after: EditorProjectVersionDiffSnapshot,
): EditorProjectVersionDiff => {
	const project = readValueChanges(
		{
			arkpackVersion: before.arkpackVersion,
			config: withoutItems(before.config),
		},
		{
			arkpackVersion: after.arkpackVersion,
			config: withoutItems(after.config),
		},
	);
	const items = readItemDiffs(before.config.items, after.config.items);
	const resources = readBinaryDiffs(before.resources, after.resources);
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
	};
};
