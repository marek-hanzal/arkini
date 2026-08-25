import { Effect } from "effect";

import { createEditorAcquisitionGraphFx } from "~/editor/createEditorAcquisitionGraphFx";
import { estimateEditorItemFx } from "~/editor/estimator/estimateEditorItemFx";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

/** Computes the immutable quantity-one estimate batch used by the global Estimate view. */
export const estimateEditorItemsFx = Effect.fn("estimateEditorItemsFx")(
	(config: GameConfigSchema.Type) =>
		Effect.gen(function* () {
			const graph = yield* createEditorAcquisitionGraphFx(config);
			return yield* Effect.forEach(Object.keys(config.items).sort(), (itemId) =>
				estimateEditorItemFx({
					factId: itemId,
					graph,
					quantity: 1,
				}),
			);
		}),
);
