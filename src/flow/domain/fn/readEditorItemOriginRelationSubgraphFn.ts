import { Order } from "effect";

import type {
	EditorItemOriginRelation,
	EditorItemOriginRelationRole,
	EditorItemOriginRelationSubgraph,
	EditorItemOriginSource,
} from "~/flow/domain/EditorItemOriginSource";
import { readEditorItemOriginRelationsFn } from "~/flow/domain/fn/readEditorItemOriginRelationsFn";

/** Traverses canonical input edges forward and output edges backward, matching editor relation lookup. */
export const readEditorItemOriginRelationSubgraphFn = ({
	level,
	role,
	sources,
	targetItemId,
}: {
	readonly level: number;
	readonly role: EditorItemOriginRelationRole;
	readonly sources: ReadonlyArray<EditorItemOriginSource>;
	readonly targetItemId: string;
}): EditorItemOriginRelationSubgraph => {
	const relationsBySourceItem = new Map<string, EditorItemOriginRelation[]>();
	const relationGroups = sources.map(readEditorItemOriginRelationsFn);
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
				Order.String(left.source.id, right.source.id) ||
				Order.String(left.toItemId, right.toItemId) ||
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
				Order.String(left.source.id, right.source.id) ||
				Order.String(left.fromItemId, right.fromItemId) ||
				Order.String(left.toItemId, right.toItemId) ||
				(left.outputIndex ?? -1) - (right.outputIndex ?? -1),
		),
	};
};
