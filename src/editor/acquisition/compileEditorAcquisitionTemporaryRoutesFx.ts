import { Effect } from "effect";

import type { EditorAcquisitionRoute } from "~/editor/EditorAcquisitionGraph";
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

const readTemporaryRoutesFx = Effect.fn("compileEditorAcquisitionTemporaryRoutesFx.item")(
	function* (item: ItemSchema.Type) {
		if (item.type !== "temporary") return [];
		const outputModel = yield* readEditorAcquisitionOutputOccurrencesFx(item.output);
		return outputModel.occurrences.map(
			(output): EditorAcquisitionRoute => ({
				durationMs: item.durationMs,
				id: `temporary-expiry:${item.id}:${output.id}:${output.factId}`,
				metadata: {
					itemId: item.id,
					kind: "temporary-expiry",
				},
				operation: {
					id: `source:${item.id}:expiry`,
					inputs: [],
					...(outputModel.compilation === "complete"
						? {}
						: {
								outputCompilation: outputModel.compilation,
							}),
					outputDistribution: outputModel.outputDistribution,
				},
				output: {
					annotation: output.annotation,
					factId: output.factId,
					operationOutputGroupId: output.operationOutputGroupId,
					quantityDistribution: output.quantityDistribution,
				},
				requirements: combineRequirements(
					{
						allOf: [
							{
								factId: item.id,
								quantity: 1,
								source: "temporary-item",
								usage: "consume",
							},
						],
						anyOf: [],
					},
					output.requirements,
				),
				runMultiplier: 1,
			}),
		);
	},
);

/** Compiles temporary-expiry acquisition routes. */
export const compileEditorAcquisitionTemporaryRoutesFx = Effect.fn(
	"compileEditorAcquisitionTemporaryRoutesFx",
)(function* (config: GameConfigSchema.Type) {
	const routes: EditorAcquisitionRoute[] = [];
	for (const item of Object.values(config.items)) {
		routes.push(...(yield* readTemporaryRoutesFx(item)));
	}
	return routes;
});
