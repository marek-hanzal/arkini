import type { EditorAcquisitionRoute } from "~/flow/domain/EditorAcquisitionGraph";
import { readEditorAcquisitionOutputOccurrencesFn } from "~/flow/domain/fn/readEditorAcquisitionOutputOccurrencesFn";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { GameConfigSchema } from "~/game-config/GameConfigSchema";

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

const readMergeRoutesFn = (source: ItemSchema.Type) => {
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
		const outputModel = readEditorAcquisitionOutputOccurrencesFn(merge.output);
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
		};
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
					expectedYield: 1,
					factId: merge.result,
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
					expectedYield:
						output.expectedYield +
						(merge.effect === "replace" && output.factId === merge.result ? 1 : 0),
					factId: output.factId,
				},
				requirements: combineRequirements(requirements, output.requirements),
				runMultiplier: 1,
			});
	}
	return routes;
};

/** Compiles merge-output and replacement acquisition routes. */
export const compileEditorAcquisitionMergeRoutesFn = (config: GameConfigSchema.Type) => {
	const routes: EditorAcquisitionRoute[] = [];
	for (const item of Object.values(config.items)) {
		routes.push(...readMergeRoutesFn(item));
	}
	return routes;
};
