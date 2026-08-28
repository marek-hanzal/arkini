import { Effect } from "effect";

import { createEditorAcquisitionGraphFx } from "~/editor/createEditorAcquisitionGraphFx";
import { estimateEditorItemsFn } from "~/editor/estimator/fn/estimateEditorItemsFn";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

/** Computes the immutable quantity-one estimate batch used by the global Estimate view. */
export const estimateEditorItemsFx = Effect.fn("estimateEditorItemsFx")(
	(config: GameConfigSchema.Type) =>
		Effect.gen(function* () {
			const graph = yield* createEditorAcquisitionGraphFx(config);
			return estimateEditorItemsFn({
				graph,
				requests: Object.keys(config.items)
					.sort()
					.map((factId) => ({
						factId,
						quantity: 1,
					})),
			});
		}),
);
