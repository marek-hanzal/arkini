import type { EditorAcquisitionRoute } from "~/flow/domain/EditorAcquisitionGraph";
import { readEditorAcquisitionOutputOccurrencesFn } from "~/flow/domain/fn/readEditorAcquisitionOutputOccurrencesFn";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

const readTemporaryRoutesFn = (item: ItemSchema.Type) => {
	if (item.type !== "temporary") return [];
	const outputModel = readEditorAcquisitionOutputOccurrencesFn(item.output);
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
			},
			output: {
				annotation: output.annotation,
				expectedYield: output.expectedYield,
				factId: output.factId,
			},
			requirements: {
				allOf: [
					{
						factId: item.id,
						quantity: 1,
						source: "temporary-item",
						usage: "consume",
					},
					...output.requirements.allOf,
				],
				anyOf: output.requirements.anyOf,
				unsupported: output.requirements.unsupported ?? [],
			},
			runMultiplier: 1,
		}),
	);
};

/** Compiles temporary-expiry acquisition routes. */
export const compileEditorAcquisitionTemporaryRoutesFn = (config: GameConfigSchema.Type) => {
	const routes: EditorAcquisitionRoute[] = [];
	for (const item of Object.values(config.items)) {
		routes.push(...readTemporaryRoutesFn(item));
	}
	return routes;
};
