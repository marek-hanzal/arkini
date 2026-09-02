import { Effect, Order } from "effect";

import type { Project } from "~/project-authoring/type/Project";
import { createAcquisitionGraphFn } from "~/flow/fn/createAcquisitionGraphFn";
import { readItemOriginSourcesFn } from "~/flow/fn/readItemOriginSourcesFn";
import type {
	ItemOriginOutputOccurrence,
	ItemOriginRelation,
	ItemOriginRelationRole,
	ItemOriginSource,
} from "~/flow/type/ItemOriginSource";
import { readItemOriginRelationsFn } from "~/flow/fn/readItemOriginRelationsFn";

interface ItemOriginRelationSubgraph {
	readonly itemIds: ReadonlySet<string>;
	readonly relations: ReadonlyArray<
		ItemOriginRelation & {
			readonly level: number;
		}
	>;
}

/** Traverses canonical input edges forward and output edges backward for one MCP relation lookup. */
const readItemOriginRelationSubgraphFn = ({
	level,
	role,
	sources,
	targetItemId,
}: {
	readonly level: number;
	readonly role: ItemOriginRelationRole;
	readonly sources: ReadonlyArray<ItemOriginSource>;
	readonly targetItemId: string;
}): ItemOriginRelationSubgraph => {
	const relationsBySourceItem = new Map<string, ItemOriginRelation[]>();
	const relationGroups = sources.map(readItemOriginRelationsFn);
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
		ItemOriginRelation & {
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

const itemReferenceFn = (project: Project, itemId: string) => {
	const item = project.config.items[itemId];
	return item === undefined ? `${itemId} [missing]` : `${item.id} [${item.title}; ${item.type}]`;
};

const formatQuantityFn = ({ max, min }: { readonly max: number; readonly min: number }) =>
	min === max ? String(min) : `${min}–${max}`;

const outputAnnotationFn = (output: ItemOriginOutputOccurrence) =>
	[
		`quantity ${formatQuantityFn(output.quantity)}`,
		output.selectionKind,
		...(output.weightedSet
			? [
					"alternative set",
				]
			: []),
		...(output.placement === undefined
			? []
			: [
					`placement ${output.placement}`,
				]),
	].join(", ");

const outputRequirementLinesFn = (project: Project, output: ItemOriginOutputOccurrence) => [
	...output.requirements.allOf.map(
		(requirement) =>
			`      requires all: ${itemReferenceFn(project, requirement.itemId)} (quantity ${formatQuantityFn(requirement.quantity)}, ${requirement.usage}, ${requirement.sources.join(", ")}${requirement.identity === "distinct" ? ", distinct identity" : ""})`,
	),
	...output.requirements.anyOf.flatMap((clause, clauseIndex) => [
		`      requires one of #${clauseIndex + 1}:`,
		...clause.map(
			(requirement) =>
				`        - ${itemReferenceFn(project, requirement.itemId)} (quantity ${formatQuantityFn(requirement.quantity)}, ${requirement.usage}, ${requirement.sources.join(", ")}${requirement.identity === "distinct" ? ", distinct identity" : ""})`,
		),
	]),
	...(output.requirements.unsupported ?? []).map(
		(requirement) =>
			`      unsupported requirement: ${itemReferenceFn(project, requirement.itemId)} (${requirement.reason}, ${requirement.source})`,
	),
];

const sourceReferenceLinesFn = (project: Project, source: ItemOriginSource) => [
	`  Source item: ${itemReferenceFn(project, source.ownerItemId)}`,
	...(() => {
		switch (source.reference.type) {
			case "line":
				return [
					`  Line ID: ${source.reference.lineId}`,
				];
			case "charges":
				return [
					"  Relationship: charge depletion",
				];
			case "expiry":
				return [
					"  Relationship: expiry",
				];
			case "merge":
				return [
					`  Merge rule: ${source.reference.ruleNumber}`,
				];
		}
	})(),
];

/** Reads and formats one directional item-relation view. */
export const readItemRelationTextFx = Effect.fn("readItemRelationTextFx")(function* (
	project: Project,
	{
		itemId,
		level,
		role,
	}: {
		readonly itemId: string;
		readonly level: number;
		readonly role: ItemOriginRelationRole;
	},
) {
	const item = project.config.items[itemId];
	if (item === undefined)
		return yield* Effect.fail(new Error(`Item ${itemId} does not exist in the open project.`));
	const graph = createAcquisitionGraphFn(project.config);
	const sources = readItemOriginSourcesFn(graph);
	const subgraph = readItemOriginRelationSubgraphFn({
		level,
		role,
		sources,
		targetItemId: itemId,
	});
	const groups = new Map<
		string,
		{
			readonly level: number;
			readonly relations: typeof subgraph.relations;
		}
	>();
	for (const relation of subgraph.relations) {
		const key = `${relation.level}:${relation.source.id}`;
		const group = groups.get(key);
		groups.set(key, {
			level: relation.level,
			relations:
				group === undefined
					? [
							relation,
						]
					: [
							...group.relations,
							relation,
						],
		});
	}
	const direction = role === "output" ? "output" : "input";
	return [
		`Item ${direction}`,
		`Item ID: ${item.id}`,
		`Title: ${item.title}`,
		`Type: ${item.type}`,
		`Level: ${level}`,
		"",
		"Operations:",
		...(groups.size === 0
			? [
					"- none",
				]
			: [
					...groups.values(),
				].flatMap((group) => {
					const source = group.relations[0]?.source;
					if (source === undefined) return [];
					const inputs = [
						...source.inputs,
					].sort((left, right) => left.itemId.localeCompare(right.itemId));
					return [
						`- Level ${group.level}: ${source.kind} "${source.label}"`,
						...sourceReferenceLinesFn(project, source),
						...(source.runtimeMs === undefined
							? []
							: [
									`  Runtime: ${source.runtimeMs / 1_000} s`,
								]),
						"  Traversed:",
						...group.relations.map(
							(relation) =>
								`    - ${itemReferenceFn(project, relation.fromItemId)} -> ${itemReferenceFn(project, relation.toItemId)}`,
						),
						...(inputs.length === 0
							? [
									"  Inputs: none",
								]
							: [
									"  Inputs:",
									...inputs.map(
										(input) =>
											`    - ${itemReferenceFn(project, input.itemId)} (quantity ${formatQuantityFn(input.quantity)})`,
									),
								]),
						"  Outputs:",
						...source.outputs.flatMap((output) => [
							`    - ${itemReferenceFn(project, output.itemId)} (${outputAnnotationFn(output)})`,
							...outputRequirementLinesFn(project, output),
						]),
					];
				})),
	].join("\n");
});
