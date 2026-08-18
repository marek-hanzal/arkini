import { Effect } from "effect";

import type {
	EditorAcquisitionOperation,
	EditorAcquisitionRoute,
} from "~/editor/EditorAcquisitionGraph";
import { readEditorAcquisitionOutputOccurrencesFx } from "~/editor/readEditorAcquisitionOutputOccurrencesFx";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

const combineRequirements = (
	left: EditorAcquisitionRoute["requirements"],
	right: EditorAcquisitionRoute["requirements"],
): EditorAcquisitionRoute["requirements"] => ({
	allOf: [
		...left.allOf,
		...right.allOf,
	],
	anyOf: [
		...left.anyOf,
		...right.anyOf,
	],
	unsupported: [
		...(left.unsupported ?? []),
		...(right.unsupported ?? []),
	],
});

const readMergeRoutesFx = Effect.fn("compileEditorAcquisitionMergeRoutesFx.item")(function* (
	source: ItemSchema.Type,
) {
	const routes: EditorAcquisitionRoute[] = [];
	const matchedTargetItemIds = new Set<string>();
	for (const [mergeIndex, merge] of (source.merge ?? []).entries()) {
		if (matchedTargetItemIds.has(merge.target.itemId)) continue;
		matchedTargetItemIds.add(merge.target.itemId);
		const requirements: EditorAcquisitionRoute["requirements"] = {
			allOf: [
				{
					factId: source.id,
					...(source.id === merge.target.itemId
						? {
								identity: "distinct" as const,
							}
						: {}),
					quantity: 1,
					source: "merge-source",
					usage: merge.action === "consume" ? "consume" : "one-time",
				},
				{
					factId: merge.target.itemId,
					...(source.id === merge.target.itemId
						? {
								identity: "distinct" as const,
							}
						: {}),
					quantity: 1,
					source: "merge-target",
					usage: merge.effect === "keep" ? "one-time" : "consume",
				},
			],
			anyOf: [],
		};
		const metadata = {
			kind: "merge-output",
			mergeIndex,
			sourceItemId: source.id,
			targetItemId: merge.target.itemId,
		} as const;
		const outputModel = yield* readEditorAcquisitionOutputOccurrencesFx(merge.output);
		const replacementOutputGroupId = "output:replacement";
		const operation = {
			id: `source:${source.id}:merge:${mergeIndex}`,
			inputs: [
				{
					factId: merge.target.itemId,
					quantity: {
						max: 1,
						min: 1,
					},
				},
			],
			...(outputModel.compilation === "complete"
				? {}
				: {
						outputCompilation: outputModel.compilation,
					}),
			outputDistribution: outputModel.outputDistribution.map((outcome) => ({
				...outcome,
				quantities:
					merge.effect === "replace"
						? [
								...outcome.quantities,
								{
									outputGroupId: replacementOutputGroupId,
									quantity: 1,
								},
							]
						: outcome.quantities,
			})),
		} satisfies EditorAcquisitionOperation;
		if (merge.effect === "replace")
			routes.push({
				durationMs: 0,
				id: `merge-replacement:${source.id}:${merge.target.itemId}:${mergeIndex}:${merge.result}`,
				metadata,
				operation,
				output: {
					annotation: {
						alternativeSet: false,
						placement: undefined,
						quantity: {
							max: 1,
							min: 1,
						},
						selectionKind: "replace",
					},
					factId: merge.result,
					operationOutputGroupId: replacementOutputGroupId,
					quantityDistribution: [
						{
							probability: 1,
							quantity: 1,
						},
					],
				},
				requirements,
				runMultiplier: 1,
			});
		for (const output of outputModel.occurrences)
			routes.push({
				durationMs: 0,
				id: `merge-output:${source.id}:${merge.target.itemId}:${mergeIndex}:${output.id}:${output.factId}`,
				metadata,
				operation,
				output: {
					annotation: output.annotation,
					factId: output.factId,
					operationOutputGroupId: output.operationOutputGroupId,
					quantityDistribution: output.quantityDistribution,
				},
				requirements: combineRequirements(requirements, output.requirements),
				runMultiplier: 1,
			});
	}
	return routes;
});

/** Compiles merge-output and replacement acquisition routes. */
export const compileEditorAcquisitionMergeRoutesFx = Effect.fn(
	"compileEditorAcquisitionMergeRoutesFx",
)(function* (config: GameConfigSchema.Type) {
	const routes: EditorAcquisitionRoute[] = [];
	for (const item of Object.values(config.items)) {
		routes.push(...(yield* readMergeRoutesFx(item)));
	}
	return routes;
});
