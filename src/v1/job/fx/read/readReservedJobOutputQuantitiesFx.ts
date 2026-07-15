import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import { readItemLineFx } from "~/v1/line/fx/readItemLineFx";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { readJobMaximumOutputQuantitiesFx } from "./readJobMaximumOutputQuantitiesFx";

export interface ReservedJobOutputQuantity {
	jobIds: IdSchema.Type[];
	quantity: number;
}

export namespace readReservedJobOutputQuantitiesFx {
	export interface Props {
		runtime: RuntimeSchema.Type;
	}
}

/** Reads worst-case future output reservations aggregated across valid active jobs. */
export const readReservedJobOutputQuantitiesFx = Effect.fn("readReservedJobOutputQuantitiesFx")(
	function* ({ runtime }: readReservedJobOutputQuantitiesFx.Props) {
		const reserved = new Map<IdSchema.Type, ReservedJobOutputQuantity>();

		for (const job of runtime.jobs) {
			const owner = runtime.items.find((item) => item.id === job.ownerItemId);
			if (owner === undefined) continue;
			const line = yield* readItemLineFx({
				item: owner.item,
				lineId: job.lineId,
			});
			if (line === undefined) continue;

			const quantities = yield* readJobMaximumOutputQuantitiesFx({
				job,
				runtime,
			});
			for (const [itemId, quantity] of quantities) {
				if (quantity <= 0) continue;
				const current = reserved.get(itemId);
				reserved.set(itemId, {
					jobIds:
						current === undefined
							? [
									job.id,
								]
							: [
									...current.jobIds,
									job.id,
								],
					quantity: (current?.quantity ?? 0) + quantity,
				});
			}
		}

		return reserved;
	},
);
