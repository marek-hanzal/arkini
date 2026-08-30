import { Order } from "effect";

import { createEditorAcquisitionGraphFn } from "~/flow/domain/fn/createEditorAcquisitionGraphFn";
import { estimateEditorItemsFn } from "~/estimate/domain/fn/estimateEditorItemsFn";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

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
