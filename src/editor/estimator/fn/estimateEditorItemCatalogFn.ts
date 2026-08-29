import { Order } from "effect";

import { createEditorAcquisitionGraphFn } from "~/editor/acquisition/fn/createEditorAcquisitionGraphFn";
import { estimateEditorItemsFn } from "~/editor/estimator/fn/estimateEditorItemsFn";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

/** Computes the immutable quantity-one estimate batch used by the global Estimate view. */
export const estimateEditorItemCatalogFn = (config: GameConfigSchema.Type) =>
	estimateEditorItemsFn({
		graph: createEditorAcquisitionGraphFn(config),
		requests: Object.keys(config.items)
			.sort(Order.String)
			.map((factId) => ({
				factId,
				quantity: 1,
			})),
	});
