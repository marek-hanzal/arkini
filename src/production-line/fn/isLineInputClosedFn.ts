import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace isLineInputClosedFn {
	export interface Props {
		readonly ownerItemId: IdSchema.Type;
		readonly lineUid: IdSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}
}

/** Returns whether one material input is closed by its active line job. */
export const isLineInputClosedFn = ({ ownerItemId, lineUid, runtime }: isLineInputClosedFn.Props) =>
	runtime.jobs.some((job) => job.ownerItemId === ownerItemId && job.lineUid === lineUid);
