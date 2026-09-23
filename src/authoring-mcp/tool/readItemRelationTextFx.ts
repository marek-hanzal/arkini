import { Effect, Order } from "effect";
import type { GraphDetailSchema } from "./GraphDetailSchema";
import { readRelationOperationSummaryFn } from "./fn/readRelationOperationSummaryFn";

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
	readonly itemUids: ReadonlySet<string>;
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
	targetItemUid,
}: {
	readonly level: number;
	readonly role: ItemOriginRelationRole;
	readonly sources: ReadonlyArray<ItemOriginSource>;
	readonly targetItemUid: string;
}): ItemOriginRelationSubgraph => {
	const relationsBySourceItem = new Map<string, ItemOriginRelation[]>();
	const relationGroups = sources.map(readItemOriginRelationsFn);
	for (const relation of relationGroups.flat()) {
		if (relation.role !== role) continue;
		const traversalSourceItemUid = role === "input" ? relation.fromItemUid : relation.toItemUid;
		const matches = relationsBySourceItem.get(traversalSourceItemUid) ?? [];
		matches.push(relation);
		relationsBySourceItem.set(traversalSourceItemUid, matches);
	}
	for (const relations of relationsBySourceItem.values())
		relations.sort(
			(left, right) =>
				Order.String(left.source.id, right.source.id) ||
				Order.String(left.toItemUid, right.toItemUid) ||
				(left.outcomeIndex ?? -1) - (right.outcomeIndex ?? -1),
		);

	const itemUids = new Set<string>([
		targetItemUid,
	]);
	const relationByKey = new Map<
		string,
		ItemOriginRelation & {
			readonly level: number;
		}
	>();
	const reachedLevelByItem = new Map<string, number>([
		[
			targetItemUid,
			0,
		],
	]);
	const pending: Array<{
		readonly itemUid: string;
		readonly level: number;
	}> = [
		{
			itemUid: targetItemUid,
			level: 0,
		},
	];
	for (let index = 0; index < pending.length; index += 1) {
		const current = pending[index];
		if (current === undefined || current.level >= level) continue;
		const nextLevel = current.level + 1;
		for (const relation of relationsBySourceItem.get(current.itemUid) ?? []) {
			const reachedItemUid = role === "input" ? relation.toItemUid : relation.fromItemUid;
			const key = JSON.stringify([
				relation.role,
				relation.source.id,
				relation.fromItemUid,
				relation.toItemUid,
				relation.outcomeIndex ?? "input",
			]);
			const existing = relationByKey.get(key);
			if (existing === undefined || nextLevel < existing.level)
				relationByKey.set(key, {
					...relation,
					level: nextLevel,
				});
			itemUids.add(reachedItemUid);
			const reachedLevel = reachedLevelByItem.get(reachedItemUid);
			if (reachedLevel !== undefined && reachedLevel <= nextLevel) continue;
			reachedLevelByItem.set(reachedItemUid, nextLevel);
			pending.push({
				itemUid: reachedItemUid,
				level: nextLevel,
			});
		}
	}
	return {
		itemUids,
		relations: [
			...relationByKey.values(),
		].sort(
			(left, right) =>
				left.level - right.level ||
				Order.String(left.source.id, right.source.id) ||
				Order.String(left.fromItemUid, right.fromItemUid) ||
				Order.String(left.toItemUid, right.toItemUid) ||
				(left.outcomeIndex ?? -1) - (right.outcomeIndex ?? -1),
		),
	};
};

const itemReferenceFn = (project: Project, itemUid: string) => {
	const item = Object.hasOwn(project.config.items, itemUid)
		? project.config.items[itemUid]
		: undefined;
	return item === undefined ? `${itemUid} [missing]` : `${item.uid} [${item.title}]`;
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
			`      requires all: ${itemReferenceFn(project, requirement.itemUid)} (quantity ${formatQuantityFn(requirement.quantity)}, ${requirement.usage}, ${requirement.sources.join(", ")}${requirement.identity === "distinct" ? ", distinct identity" : ""})`,
	),
	...output.requirements.anyOf.flatMap((clause, clauseIndex) => [
		`      requires one of #${clauseIndex + 1}:`,
		...clause.map(
			(requirement) =>
				`        - ${itemReferenceFn(project, requirement.itemUid)} (quantity ${formatQuantityFn(requirement.quantity)}, ${requirement.usage}, ${requirement.sources.join(", ")}${requirement.identity === "distinct" ? ", distinct identity" : ""})`,
		),
	]),
	...(output.requirements.unsupported ?? []).map(
		(requirement) =>
			`      unsupported requirement: ${itemReferenceFn(project, requirement.itemUid)} (${requirement.reason}, ${requirement.source})`,
	),
];

const sourceReferenceLinesFn = (project: Project, source: ItemOriginSource) => [
	`  Source item: ${itemReferenceFn(project, source.ownerItemUid)}`,
	...(() => {
		switch (source.reference.type) {
			case "line":
				return [
					`  Line ID: ${source.reference.lineId}`,
				];
			case "units":
				return [
					"  Relationship: unit depletion",
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
		itemUid,
		level,
		role,
		detail = "full",
	}: {
		readonly detail?: GraphDetailSchema.Type;
		readonly itemUid: string;
		readonly level: number;
		readonly role: ItemOriginRelationRole;
	},
) {
	const item = Object.hasOwn(project.config.items, itemUid)
		? project.config.items[itemUid]
		: undefined;
	if (item === undefined)
		return yield* Effect.fail(new Error(`Item ${itemUid} does not exist in the open project.`));
	const graph = createAcquisitionGraphFn(project.config);
	const sources = readItemOriginSourcesFn(graph);
	const subgraph = readItemOriginRelationSubgraphFn({
		level,
		role,
		sources,
		targetItemUid: itemUid,
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
	const routesById = new Map(
		graph.routes.map((route) => [
			route.id,
			route,
		]),
	);
	if (detail === "summary") {
		const byLevel = new Map<number, number>();
		const byKind = new Map<string, number>();

		const operations: string[] = [];
		for (const group of groups.values()) {
			const source = group.relations[0]!.source;
			byLevel.set(group.level, (byLevel.get(group.level) ?? 0) + 1);
			byKind.set(source.kind, (byKind.get(source.kind) ?? 0) + 1);
			operations.push(
				`- Level ${group.level}: ${source.kind} "${source.label}" | ${itemReferenceFn(project, source.ownerItemUid)}`,
				...readRelationOperationSummaryFn(
					project,
					source,
					source.routeIds.flatMap((id) => {
						const route = routesById.get(id);
						return route === undefined
							? []
							: [
									route,
								];
					}),
				),
			);
		}
		return [
			`Item ${direction}`,
			`Item UID: ${item.uid}`,
			`Title: ${item.title}`,
			`Level: ${level}`,
			"Detail: summary",
			...(groups.size === 0
				? []
				: [
						"Sets: weighted eligible alternatives; chance: per roll within set. Rules are unevaluated; enable rules require all, disable rules veto. Placement defaults to drop.",
					]),
			...operations,
			`Operations: ${groups.size}`,
			`By level: ${Array.from(byLevel, ([depth, count]) => `L${depth}=${count}`).join(", ") || "none"}`,
			`By kind: ${Array.from(byKind, ([kind, count]) => `${kind}=${count}`).join(", ") || "none"}`,
		].join("\n");
	}
	return [
		`Item ${direction}`,
		`Item UID: ${item.uid}`,
		`Title: ${item.title}`,
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

					return [
						`- Level ${group.level}: ${source.kind} "${source.label}"`,
						...sourceReferenceLinesFn(project, source),
						...readRelationOperationSummaryFn(
							project,
							source,
							source.routeIds.flatMap((id) => {
								const route = routesById.get(id);
								return route === undefined
									? []
									: [
											route,
										];
							}),
						),
						"  Traversed:",
						...group.relations.map(
							(relation) =>
								`    - ${itemReferenceFn(project, relation.fromItemUid)} -> ${itemReferenceFn(project, relation.toItemUid)}`,
						),
						"  Item acquisition witnesses:",
						...source.outputs.flatMap((output) => [
							`    - ${itemReferenceFn(project, output.itemUid)} (${outputAnnotationFn(output)})`,
							...outputRequirementLinesFn(project, output),
						]),
					];
				})),
	].join("\n");
});
