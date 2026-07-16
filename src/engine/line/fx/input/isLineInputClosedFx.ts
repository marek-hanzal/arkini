import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { InputMaterialSchema } from "~/engine/input/schema/InputMaterialSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace isLineInputClosedFx {
	export interface Props {
		input: Pick<InputMaterialSchema.Type, "capacity">;
		ownerItemId: IdSchema.Type;
		lineId: IdSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Returns whether one zero-capacity input is closed by its active line job. */
export const isLineInputClosedFx = Effect.fn("isLineInputClosedFx")(function* ({
	input,
	ownerItemId,
	lineId,
	runtime,
}: isLineInputClosedFx.Props) {
	return (
		input.capacity === 0 &&
		runtime.jobs.some((job) => {
			return job.ownerItemId === ownerItemId && job.lineId === lineId;
		})
	);
});
