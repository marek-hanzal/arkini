import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { readItemLineFx } from "~/engine/line/fx/readItemLineFx";
import type { LineRunPlanSchema } from "~/engine/line/schema/run/LineRunPlanSchema";
import { readRuntimeItemByIdFx } from "~/engine/runtime/read/readRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { readPlannedLineNetMaximumOutputQuantitiesFx } from "./readPlannedLineNetMaximumOutputQuantitiesFx";
import { readUnplannedLineNetMaximumOutputQuantitiesFx } from "./readUnplannedLineNetMaximumOutputQuantitiesFx";
import { resolveDirectLineOutputMaxCountFx } from "./resolveDirectLineOutputMaxCountFx";
import { resolveOneHopLineOutputMaxCountFx } from "./resolveOneHopLineOutputMaxCountFx";

export namespace resolveLineStartOutputMaxCountFx {
	export interface Props {
		readonly lineId: IdSchema.Type;
		readonly ownerItemId: IdSchema.Type;
		readonly plan: LineRunPlanSchema.Type | undefined;
		readonly runtime: RuntimeSchema.Type;
	}

	export type Block =
		| {
				readonly kind: "direct-output-max-count";
				readonly itemId: IdSchema.Type;
				readonly liveQuantity: number;
				readonly reservedQuantity: number;
				readonly maxCount: number;
				readonly excessQuantity: number;
		  }
		| {
				readonly kind: "downstream-output-max-count";
				readonly intermediateItemId: IdSchema.Type;
				readonly itemId: IdSchema.Type;
				readonly liveQuantity: number;
				readonly reservedQuantity: number;
				readonly maxCount: number;
				readonly excessQuantity: number;
		  };
}

/** Pure candidate reservation resolver shared by reads and every admission path. */
export const resolveLineStartOutputMaxCountFx = Effect.fn("resolveLineStartOutputMaxCountFx")(
	function* ({ lineId, ownerItemId, plan, runtime }: resolveLineStartOutputMaxCountFx.Props) {
		const owner = yield* readRuntimeItemByIdFx({
			itemId: ownerItemId,
			runtime,
		});
		const line = yield* readItemLineFx({
			item: owner.item,
			lineId,
		});
		if (line === undefined) return undefined;
		const netOutput =
			plan === undefined
				? yield* readUnplannedLineNetMaximumOutputQuantitiesFx({
						line,
						owner,
					})
				: yield* readPlannedLineNetMaximumOutputQuantitiesFx({
						line,
						plan,
						runtime,
					});
		/*
		 * Prefer the purpose-bound target violation over an intermediate
		 * Blueprint's own cap so the player sees the limit that actually makes
		 * another Blueprint useless.
		 */
		const downstream = yield* resolveOneHopLineOutputMaxCountFx({
			line,
			netOutput,
			runtime,
		});
		if (downstream !== undefined) {
			return {
				kind: "downstream-output-max-count",
				...downstream,
			} satisfies resolveLineStartOutputMaxCountFx.Block;
		}
		const direct = yield* resolveDirectLineOutputMaxCountFx({
			line,
			netOutput,
			runtime,
		});
		if (direct === undefined) return undefined;
		return {
			kind: "direct-output-max-count",
			...direct,
		} satisfies resolveLineStartOutputMaxCountFx.Block;
	},
);
