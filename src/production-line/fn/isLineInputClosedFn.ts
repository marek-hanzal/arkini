import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { MaterialSchema } from "~/production-input/schema/MaterialSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace isLineInputClosedFn {
	export interface Props {
		readonly input: Pick<MaterialSchema.Type, "capacity">;
		readonly ownerItemId: IdSchema.Type;
		readonly lineId: IdSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}
}

/** Returns whether one zero-capacity input is closed by its active line job. */
export const isLineInputClosedFn = ({
	input,
	ownerItemId,
	lineId,
	runtime,
}: isLineInputClosedFn.Props) =>
	input.capacity === 0 &&
	runtime.jobs.some((job) => job.ownerItemId === ownerItemId && job.lineId === lineId);
