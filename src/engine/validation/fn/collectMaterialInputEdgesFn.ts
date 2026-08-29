import type { GameSourceProvenanceSchema } from "~/engine/source/schema/GameSourceProvenanceSchema";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { TypeSchema } from "~/engine/input/schema/TypeSchema";

import type { MaterialInputEdgeSchema } from "../schema/MaterialInputEdgeSchema";
import { readItemLineEntriesFn } from "./readItemLineEntriesFn";

export namespace collectMaterialInputEdgesFn {
	export interface Props {
		config: GameConfigSchema.Type;
		provenance: GameSourceProvenanceSchema.Type;
	}
}

/** Expands material input selectors into concrete owner-to-item capability edges. */
export const collectMaterialInputEdgesFn = ({
	config,
	provenance,
}: collectMaterialInputEdgesFn.Props) => {
	const edges: MaterialInputEdgeSchema.Type[] = [];

	for (const [ownerItemId, item] of Object.entries(config.items)) {
		const lines = readItemLineEntriesFn({
			itemId: ownerItemId,
			item,
		});

		for (const { line, path } of lines) {
			for (const [inputIndex, input] of line.input.entries()) {
				if (input.type !== TypeSchema.enum.Materials) {
					continue;
				}

				const acceptedItemIds =
					config.items[input.selector.itemId] === undefined
						? []
						: [
								input.selector.itemId,
							];

				for (const acceptedItemId of acceptedItemIds) {
					edges.push({
						ownerItemId,
						acceptedItemId,
						path: [
							...path,
							"input",
							inputIndex,
							"selector",
						],
						source: provenance.items[ownerItemId],
					});
				}
			}
		}
	}

	return edges;
};
