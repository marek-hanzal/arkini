import { Effect } from "effect";
import { match } from "ts-pattern";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import { resolveItemFx } from "~/v1/item/fx/resolveItemFx";
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

/** Reads the per-item worst-case output reserved by one active job's implemented lifecycle. */
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

		return yield* match(owner.item)
			.with(
				{
					type: "blueprint",
				},
				(item) =>
					Effect.gen(function* () {
						const target = yield* resolveItemFx({
							itemId: item.targetId,
						});
						const quantities =
							item.output === undefined
								? new Map<IdSchema.Type, number>()
								: yield* readOutputMaximumQuantitiesFx({
										output: item.output,
									});
						quantities.set(target.id, (quantities.get(target.id) ?? 0) + 1);
						return quantities;
					}),
			)
			.otherwise(() =>
				line.output === undefined
					? Effect.succeed(new Map<IdSchema.Type, number>())
					: readOutputMaximumQuantitiesFx({
							output: line.output,
						}),
			);
	},
);
