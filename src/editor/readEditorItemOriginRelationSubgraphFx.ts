import { Effect } from "effect";

import type {
	EditorItemOriginRelation,
	EditorItemOriginRelationRole,
	EditorItemOriginRelationSubgraph,
	EditorItemOriginSource,
} from "~/editor/EditorItemOriginSource";
import { readEditorItemOriginRelationsFx } from "~/editor/readEditorItemOriginRelationsFx";

/** Traverses canonical input edges forward and output edges backward, matching editor relation lookup. */
export const readEditorItemOriginRelationSubgraphFx = Effect.fn(
	"readEditorItemOriginRelationSubgraphFx",
)(function* ({
	level,
	role,
	sources,
	targetItemId,
}: {
	readonly level: number;
	readonly role: EditorItemOriginRelationRole;
	readonly sources: ReadonlyArray<EditorItemOriginSource>;
	readonly targetItemId: string;
}): Effect.fn.Return<EditorItemOriginRelationSubgraph> {
	const relationsBySourceItem = new Map<string, EditorItemOriginRelation[]>();
	const relationGroups = yield* Effect.forEach(sources, readEditorItemOriginRelationsFx);
	for (const relation of relationGroups.flat()) {
		if (relation.role !== role) continue;
		const traversalSourceItemId = role === "input" ? relation.fromItemId : relation.toItemId;
		const matches = relationsBySourceItem.get(traversalSourceItemId) ?? [];
		matches.push(relation);
		relationsBySourceItem.set(traversalSourceItemId, matches);
	}
	for (const relations of relationsBySourceItem.values())
		relations.sort(
			(left, right) =>
				left.source.id.localeCompare(right.source.id) ||
				left.toItemId.localeCompare(right.toItemId) ||
				(left.outputIndex ?? -1) - (right.outputIndex ?? -1),
		);

	const itemIds = new Set<string>([
		targetItemId,
	]);
	const relationByKey = new Map<
		string,
		EditorItemOriginRelation & {
			readonly level: number;
		}
	>();
	const reachedLevelByItem = new Map<string, number>([
		[
			targetItemId,
			0,
		],
	]);
	const pending: Array<{
		readonly itemId: string;
		readonly level: number;
	}> = [
		{
			itemId: targetItemId,
			level: 0,
		},
	];
	for (let index = 0; index < pending.length; index += 1) {
		const current = pending[index];
		if (current === undefined || current.level >= level) continue;
		const nextLevel = current.level + 1;
		for (const relation of relationsBySourceItem.get(current.itemId) ?? []) {
			const reachedItemId = role === "input" ? relation.toItemId : relation.fromItemId;
			const key = JSON.stringify([
				relation.role,
				relation.source.id,
				relation.fromItemId,
				relation.toItemId,
				relation.outputIndex ?? "input",
			]);
			const existing = relationByKey.get(key);
			if (existing === undefined || nextLevel < existing.level)
				relationByKey.set(key, {
					...relation,
					level: nextLevel,
				});
			itemIds.add(reachedItemId);
			const reachedLevel = reachedLevelByItem.get(reachedItemId);
			if (reachedLevel !== undefined && reachedLevel <= nextLevel) continue;
			reachedLevelByItem.set(reachedItemId, nextLevel);
			pending.push({
				itemId: reachedItemId,
				level: nextLevel,
			});
		}
	}
	return {
		itemIds,
		relations: [
			...relationByKey.values(),
		].sort(
			(left, right) =>
				left.level - right.level ||
				left.source.id.localeCompare(right.source.id) ||
				left.fromItemId.localeCompare(right.fromItemId) ||
				left.toItemId.localeCompare(right.toItemId) ||
				(left.outputIndex ?? -1) - (right.outputIndex ?? -1),
		),
	};
});
