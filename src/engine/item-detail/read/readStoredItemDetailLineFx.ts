import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { ItemDetailLines } from "~/engine/item-detail/read/ItemDetailLines";
import { readItemDetailInputsFx } from "~/engine/item-detail/read/readItemDetailInputsFx";
import { readItemDetailOutputFx } from "~/engine/item-detail/read/readItemDetailOutputFx";
import { JobStatusEnumSchema } from "~/engine/job/schema/read/JobStatusEnumSchema";
import type { LineSchema } from "~/engine/line/schema/LineSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace readStoredItemDetailLineFx {
	export interface Props {
		readonly activeJob: RuntimeSchema.Type["jobs"][number] | undefined;
		readonly line: LineSchema.Type;
		readonly ownerItemId: IdSchema.Type;
		readonly runtime: RuntimeSchema.Type;
		readonly isDefault: boolean;
	}
}

/** Projects one visible line whose owner is paused in passive storage. */
export const readStoredItemDetailLineFx = Effect.fn("readStoredItemDetailLineFx")(function* ({
	activeJob,
	line,
	ownerItemId,
	runtime,
	isDefault,
}: readStoredItemDetailLineFx.Props) {
	return {
		lineId: line.id,
		title: line.title,
		description: line.description,
		baseRuntimeMs: line.runtimeMs,
		effectiveRuntimeMs: line.runtimeMs,
		availability: {
			kind: "unavailable",
			reason: {
				kind: "owner-stored",
			},
		},
		isDefault,
		actions: {
			immediate: {
				type: "fill",
				enabled: false,
			},
			enqueue: {
				enabled: false,
			},
			canWithdraw: false,
		},
		input: yield* readItemDetailInputsFx({
			configured: line.input,
			lineId: line.id,
			ownerItemId,
			runtime,
		}),
		output: yield* readItemDetailOutputFx(line),
		...(activeJob === undefined
			? {}
			: {
					activeJob: {
						status: JobStatusEnumSchema.enum.Paused,
						durationMs: activeJob.durationMs,
						remainingMs: activeJob.remainingMs,
					},
				}),
	} satisfies ItemDetailLines.Line;
});
