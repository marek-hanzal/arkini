import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { JobSchema } from "~/v1/job/schema/JobSchema";
import { readItemLineFx } from "~/v1/line/fx/readItemLineFx";
import { readOutputMaximumQuantitiesFx } from "~/v1/output/fx/readOutputMaximumQuantitiesFx";
import { readRuntimeItemByIdFx } from "~/v1/runtime/read/readRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

export namespace readJobMaximumOutputQuantitiesFx {
	export interface Props {
		job: JobSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/**
 * Reads the per-item worst-case net quantity increase reserved by one active job.
 *
 * A remove-after-completion owner already contributes its live quantity to maxCount,
 * so an output of the same canonical item reserves only the increase beyond that
 * quantity. The result never exposes negative future capacity.
 */
export const readJobMaximumOutputQuantitiesFx = Effect.fn("readJobMaximumOutputQuantitiesFx")(
	function* ({ job, runtime }: readJobMaximumOutputQuantitiesFx.Props) {
		const owner = yield* readRuntimeItemByIdFx({
			itemId: job.ownerItemId,
			runtime,
		});
		const line = yield* readItemLineFx({
			item: owner.item,
			lineId: job.lineId,
		});
		if (line === undefined) {
			return yield* Effect.dieMessage(`Job ${job.id} line ${job.lineId} is missing.`);
		}

		const quantities =
			line.output === undefined
				? new Map<IdSchema.Type, number>()
				: yield* readOutputMaximumQuantitiesFx({
						output: line.output,
					});
		if (!("afterCompletion" in owner.item) || owner.item.afterCompletion !== "remove") {
			return quantities;
		}

		const ownerOutputQuantity = quantities.get(owner.item.id) ?? 0;
		const netOwnerQuantity = Math.max(0, ownerOutputQuantity - owner.quantity);
		if (netOwnerQuantity === 0) {
			quantities.delete(owner.item.id);
		} else {
			quantities.set(owner.item.id, netOwnerQuantity);
		}

		return quantities;
	},
);
