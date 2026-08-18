import { Effect } from "effect";

import type { EditorProject } from "../../src/editor/EditorProject";
import { createEditorAcquisitionGraphFx } from "../../src/editor/createEditorAcquisitionGraphFx";
import type {
	EditorItemOriginOutputOccurrence,
	EditorItemOriginRelationRole,
	EditorItemOriginSource,
} from "../../src/editor/EditorItemOriginSource";
import { readEditorItemOriginRelationSubgraphFx } from "../../src/editor/readEditorItemOriginRelationSubgraphFx";
import { readEditorItemOriginSourcesFx } from "../../src/editor/readEditorItemOriginSourcesFx";

const itemReference = (project: EditorProject, itemId: string) => {
	const item = project.config.items[itemId];
	return item === undefined ? `${itemId} [missing]` : `${item.id} [${item.title}; ${item.type}]`;
};

const formatQuantity = ({ max, min }: { readonly max: number; readonly min: number }) =>
	min === max ? String(min) : `${min}–${max}`;

const outputAnnotation = (output: EditorItemOriginOutputOccurrence) =>
	[
		`quantity ${formatQuantity(output.quantity)}`,
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

const outputRequirementLines = (
	project: EditorProject,
	output: EditorItemOriginOutputOccurrence,
) => [
	...output.requirements.allOf.map(
		(requirement) =>
			`      requires all: ${itemReference(project, requirement.itemId)} (quantity ${formatQuantity(requirement.quantity)}, ${requirement.usage}, ${requirement.sources.join(", ")}${requirement.identity === "distinct" ? ", distinct identity" : ""})`,
	),
	...output.requirements.anyOf.flatMap((clause, clauseIndex) => [
		`      requires one of #${clauseIndex + 1}:`,
		...clause.map(
			(requirement) =>
				`        - ${itemReference(project, requirement.itemId)} (quantity ${formatQuantity(requirement.quantity)}, ${requirement.usage}, ${requirement.sources.join(", ")}${requirement.identity === "distinct" ? ", distinct identity" : ""})`,
		),
	]),
	...(output.requirements.unsupported ?? []).map(
		(requirement) =>
			`      unsupported requirement: ${itemReference(project, requirement.itemId)} (${requirement.reason}, ${requirement.source})`,
	),
];

const sourceReferenceLines = (project: EditorProject, source: EditorItemOriginSource) => [
	`  Source item: ${itemReference(project, source.ownerItemId)}`,
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
export const readEditorMcpItemRelationTextFx = Effect.fn("readEditorMcpItemRelationTextFx")(
	function* (
		project: EditorProject,
		{
			itemId,
			level,
			role,
		}: {
			readonly itemId: string;
			readonly level: number;
			readonly role: EditorItemOriginRelationRole;
		},
	) {
		const item = project.config.items[itemId];
		if (item === undefined)
			return yield* Effect.fail(
				new Error(`Item ${itemId} does not exist in the open project.`),
			);
		const graph = yield* createEditorAcquisitionGraphFx(project.config);
		const sources = yield* readEditorItemOriginSourcesFx(graph);
		const subgraph = yield* readEditorItemOriginRelationSubgraphFx({
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
							...sourceReferenceLines(project, source),
							...(source.runtimeMs === undefined
								? []
								: [
										`  Runtime: ${source.runtimeMs / 1_000} s`,
									]),
							"  Traversed:",
							...group.relations.map(
								(relation) =>
									`    - ${itemReference(project, relation.fromItemId)} -> ${itemReference(project, relation.toItemId)}`,
							),
							...(inputs.length === 0
								? [
										"  Inputs: none",
									]
								: [
										"  Inputs:",
										...inputs.map(
											(input) =>
												`    - ${itemReference(project, input.itemId)} (quantity ${formatQuantity(input.quantity)})`,
										),
									]),
							"  Outputs:",
							...source.outputs.flatMap((output) => [
								`    - ${itemReference(project, output.itemId)} (${outputAnnotation(output)})`,
								...outputRequirementLines(project, output),
							]),
						];
					})),
		].join("\n");
	},
);
