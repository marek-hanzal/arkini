import { match, P } from "ts-pattern";

import type { JobSchema } from "~/engine/job/schema/JobSchema";
import { TypeSchema } from "~/engine/item/schema/TypeSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";

export namespace readTileActorProgressRatioFn {
	export interface Props {
		readonly activeJob?: JobSchema.Type;
		readonly item: RuntimeItemSchema.Type;
	}
}

const clampRatio = (ratio: number) => Math.max(0, Math.min(1, ratio));

/**
 * Projects forward job progress and reverse temporary lifetime from canonical runtime values.
 */
export const readTileActorProgressRatioFn = ({
	activeJob,
	item,
}: readTileActorProgressRatioFn.Props) =>
	match({
		activeJob,
		item,
	})
		.with(
			{
				activeJob: P.nonNullable,
			},
			({ activeJob: job }) =>
				job.durationMs <= 0 ? 1 : clampRatio(1 - job.remainingMs / job.durationMs),
		)
		.with(
			{
				activeJob: P.nullish,
				item: {
					item: {
						type: TypeSchema.enum.Temporary,
					},
				},
			},
			({ item: temporary }) =>
				temporary.item.durationMs <= 0
					? 0
					: clampRatio(
							(temporary.remainingDurationMs ?? temporary.item.durationMs) /
								temporary.item.durationMs,
						),
		)
		.otherwise(() => undefined);
