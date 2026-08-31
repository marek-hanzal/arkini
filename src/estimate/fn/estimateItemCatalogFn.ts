import { Order } from "effect";

import { createAcquisitionGraphFn } from "~/flow/fn/createAcquisitionGraphFn";
import { estimateRequestsFn } from "~/estimate/fn/estimateRequestsFn";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

/** Computes the immutable quantity-one estimate batch used by the global Estimate view. */
export const estimateItemCatalogFn = (config: GameConfigSchema.Type) =>
	estimateRequestsFn({
		graph: createAcquisitionGraphFn(config),
		requests: Object.keys(config.items)
			.sort(Order.String)
			.map((factId) => ({
				factId,
				quantity: 1,
			})),
	});
